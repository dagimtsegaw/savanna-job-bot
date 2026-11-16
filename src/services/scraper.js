import {
  CATEGORY_MATCHERS,
  GENERIC,
  JOBISH,
  NAV_BLOCK,
  SOURCES,
  UA,
} from '../data/catalog.js';
import { safeError } from '../utils/safeLog.js';
import { browserRuntimeAvailable, configureBrowserPath, ensureFirefox } from './browsers.js';

export function slugToTitle(slug) {
  const withoutId = String(slug || '').replace(/^(?=[A-Za-z0-9]*[A-Z0-9])[A-Za-z0-9]{10}-/, '');
  const withoutExt = withoutId.replace(/\.\w+$/, '');
  return titleCase(withoutExt.replace(/-/g, ' ').replace(/_/g, ' ').trim());
}

function titleCase(value) {
  return value.replace(/[0-9A-Za-z]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function jobCats(title) {
  return Object.entries(CATEGORY_MATCHERS)
    .filter(([, matcher]) => matcher.test(title))
    .map(([key]) => key);
}

export function matches(job, cats) {
  if (!cats || cats.length === 0) {
    return true;
  }
  return job.cats.some((cat) => cats.includes(cat));
}

function stripWww(host) {
  return String(host || '').replace(/^www\./i, '');
}

function cleanHref(href) {
  return String(href || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
}

export function extractJobs(src, anchors) {
  const baseHost = stripWww(new URL(src.url).host);
  const pattern = src.pattern ? new RegExp(src.pattern) : null;
  const jobs = [];
  const seen = new Set();
  for (const anchor of anchors || []) {
    const href = cleanHref(anchor.href);
    let parsed;
    try {
      parsed = new URL(href);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      continue;
    }
    if (stripWww(parsed.host) !== baseHost) {
      continue;
    }
    if (href === src.url.replace(/\/+$/, '') || seen.has(href)) {
      continue;
    }
    const slug = parsed.pathname.split('/').pop() || '';
    if (pattern) {
      if (!pattern.test(href)) {
        continue;
      }
    } else if (NAV_BLOCK.test(parsed.pathname) || !(JOBISH.test(parsed.pathname) || hyphenCount(slug) >= 2)) {
      continue;
    }
    const lines = String(anchor.text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !GENERIC.test(line));
    const title = (lines[0] || slugToTitle(slug)).slice(0, 140);
    if (title.length < (pattern ? 4 : 8)) {
      continue;
    }
    seen.add(href);
    jobs.push({ title, link: href, source: src.name, cats: jobCats(title) });
    if (!pattern && jobs.length >= 40) {
      break;
    }
  }
  return jobs;
}

function hyphenCount(value) {
  return (String(value).match(/-/g) || []).length;
}

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function attr(source, name) {
  const match = String(source).match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] || match?.[2] || match?.[3] || '';
}

export function anchorsFromHtml(html, pageUrl) {
  const anchors = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const raw = attr(match[1], 'href');
    if (!raw || raw.startsWith('#') || /^javascript:/i.test(raw)) {
      continue;
    }
    let href;
    try {
      href = new URL(raw, pageUrl).href;
    } catch {
      continue;
    }
    const titled = decodeEntities(attr(match[1], 'data-title')).trim();
    const inner = decodeEntities(match[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    anchors.push({ href, text: titled || inner });
  }
  return anchors;
}

export function jobsFromNextData(src, html) {
  if (src?.name !== 'EthioJobs') {
    return [];
  }
  const match = String(html || '').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) {
    return [];
  }
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const rows = data?.props?.pageProps?.jobs?.data;
  if (!Array.isArray(rows)) {
    return [];
  }
  const jobs = [];
  const seen = new Set();
  for (const row of rows) {
    const title = decodeEntities(row?.title || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    const slug = String(row?.slug || '').trim();
    if (!title || !slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    const link = `https://ethiojobs.net/jobs/${encodeURIComponent(slug)}`;
    jobs.push({ title, link, source: src.name, cats: jobCats(title) });
  }
  return jobs;
}

export async function readSource(src, fetchImpl = fetch) {
  const response = await fetchImpl(src.url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!response?.ok) {
    throw new Error(`${src.name} ${response?.status || 'failed'}`);
  }
  const html = await response.text();
  const embedded = jobsFromNextData(src, html);
  if (embedded.length) {
    return embedded;
  }
  if (!src.pattern) {
    return [];
  }
  return extractJobs(src, anchorsFromHtml(html, response.url || src.url));
}

async function readSources(sources, read) {
  const all = [];
  for (const src of sources) {
    try {
      const found = await read(src);
      console.log(`[jobbot] ${src.name}: ${found.length} jobs`);
      all.push(...found);
    } catch (error) {
      console.warn(`[jobbot] ${src.name} failed: ${safeError(error)}`);
    }
  }
  return all;
}

async function launchFirefox(firefox) {
  try {
    return await firefox.launch({ headless: true });
  } catch (error) {
    if (process.env.RENDER === 'true') {
      console.error(
        '[jobbot] Firefox did not start. In the Render dashboard, set this service runtime to Docker. The Dockerfile uses the Playwright image, which includes Firefox and the libraries it needs.',
      );
    }
    throw error;
  }
}

async function fetchWithBrowser(sources) {
  await ensureFirefox();
  configureBrowserPath();
  const { firefox } = await import('playwright');
  const all = [];
  const browser = await launchFirefox(firefox);
  try {
    const context = await browser.newContext({ userAgent: UA });
    for (const src of sources) {
      let page;
      try {
        page = await context.newPage();
        await page.goto(src.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        try {
          await page.waitForLoadState('networkidle', { timeout: 15000 });
        } catch {
          // A listing page often keeps one connection open.
        }
        await page.waitForTimeout(2500);
        const anchors = await page.$$eval('a[href]', (els) => els.map((el) => ({
          href: el.href,
          text: el.innerText,
        })));
        const found = extractJobs(src, anchors);
        console.log(`[jobbot] ${src.name}: ${found.length} jobs`);
        all.push(...found);
      } catch (error) {
        console.warn(`[jobbot] ${src.name} failed: ${safeError(error)}`);
      } finally {
        if (page) {
          await page.close().catch(() => {});
        }
      }
    }
  } finally {
    await browser.close();
  }
  return all;
}

export async function fetchAll(sources = SOURCES, options = {}) {
  const browse = options.browse || fetchWithBrowser;
  const read = options.read || readSource;
  const allowBrowser = options.allowBrowser ?? browserRuntimeAvailable();
  if (allowBrowser) {
    try {
      const jobs = await browse(sources);
      if (options.browse || jobs.length) {
        return jobs;
      }
      console.warn('[jobbot] browser scrape found no jobs. Reading the pages directly.');
    } catch (error) {
      console.warn(`[jobbot] browser scrape failed (${safeError(error)}). Reading the pages directly.`);
    }
  } else {
    console.info('[jobbot] Reading job pages directly. Firefox is not available in this runtime.');
  }
  return readSources(sources, read);
}
