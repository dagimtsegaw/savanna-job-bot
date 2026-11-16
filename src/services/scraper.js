import {
  CATEGORY_MATCHERS,
  GENERIC,
  JOBISH,
  NAV_BLOCK,
  SOURCES,
  UA,
} from '../data/catalog.js';
import { safeError } from '../utils/safeLog.js';

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

export async function fetchAll(sources = SOURCES) {
  const { firefox } = await import('playwright');
  const all = [];
  const browser = await firefox.launch();
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
