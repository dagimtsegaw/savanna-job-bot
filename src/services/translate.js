import { config } from '../config.js';
import { NLLB_CODES, UA } from '../data/catalog.js';
import { getDatabase } from '../db.js';
import { safeError } from '../utils/safeLog.js';
import { sleep } from '../utils/sleep.js';

const ADDIS_TRANSLATE = new Set(['am', 'om', 'ti']);
const nllbState = { ok: null, pipe: null };
let googleTail = Promise.resolve();
let announcedAddis = false;

export function resolveNllbModel(name = config.nllbModel) {
  if (name === 'facebook/nllb-200-distilled-600M') {
    return 'Xenova/nllb-200-distilled-600M';
  }
  return name;
}

export function resetTranslationState() {
  nllbState.ok = null;
  nllbState.pipe = null;
  announcedAddis = false;
}

async function defaultNllb(text, lang) {
  if (!(await loadNllb())) {
    throw new Error('nllb off');
  }
  const result = await nllbState.pipe(text, {
    src_lang: 'eng_Latn',
    tgt_lang: NLLB_CODES[lang],
  });
  const row = Array.isArray(result) ? result[0] : result;
  const translated = row?.translation_text || row?.generated_text || '';
  if (!translated) {
    throw new Error('empty nllb output');
  }
  return translated;
}

async function loadNllb() {
  if (nllbState.ok !== null) {
    return nllbState.ok;
  }
  if (config.translator === 'google') {
    nllbState.ok = false;
    return false;
  }
  try {
    const { pipeline } = await import('@huggingface/transformers');
    const model = resolveNllbModel();
    console.log(`[jobbot] Loading NLLB translation model (${model}). The first run downloads a large file.`);
    nllbState.pipe = await pipeline('translation', model);
    nllbState.ok = true;
    console.log('[jobbot] NLLB ready. Translations are offline.');
  } catch (error) {
    console.warn(`[jobbot] NLLB not available (${safeError(error)}). Using Google Translate.`);
    nllbState.ok = false;
  }
  return nllbState.ok;
}

function addisRoot(value) {
  let root = String(value || 'https://api.addisassistant.com').trim().replace(/\/$/, '');
  if (root.endsWith('/api/v1')) {
    root = root.slice(0, -'/api/v1'.length);
  }
  return root || 'https://api.addisassistant.com';
}

export async function addisTranslate(text, lang, options = {}) {
  const key = options.key ?? config.addisKey;
  if (!key || !ADDIS_TRANSLATE.has(lang) || !text) {
    throw new Error('addis translate off');
  }
  const fetchImpl = options.fetchImpl || fetch;
  const base = addisRoot(options.base ?? config.addisBase);
  const response = await fetchImpl(`${base}/api/v1/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({
      text: String(text).slice(0, 5000),
      source_language: 'en',
      target_language: lang,
    }),
    signal: AbortSignal.timeout(options.timeoutMs || 20000),
  });
  if (!response.ok) {
    throw new Error(`addis translate ${response.status}`);
  }
  const data = await response.json();
  const out = data?.data?.translation || data?.data?.text || data?.translation || data?.text || '';
  if (!out || typeof out !== 'string') {
    throw new Error('empty addis translation');
  }
  return out.trim();
}

export async function googleTranslate(text, lang) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', lang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);
  const response = await fetch(url, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`google translate ${response.status}`);
  }
  const data = await response.json();
  const out = Array.isArray(data?.[0]) ? data[0].map((part) => part?.[0] || '').join('') : '';
  if (!out) {
    throw new Error('empty google translation');
  }
  return out;
}

export const engines = {
  nllbTranslate: defaultNllb,
  googleTranslate,
  addisTranslate: (text, lang) => addisTranslate(text, lang),
};

export function setTranslators(next) {
  if (next.nllbTranslate) {
    engines.nllbTranslate = next.nllbTranslate;
  }
  if (next.googleTranslate) {
    engines.googleTranslate = next.googleTranslate;
  }
  if (next.addisTranslate) {
    engines.addisTranslate = next.addisTranslate;
  }
}

function withGoogleLock(fn) {
  const run = googleTail.then(() => fn());
  googleTail = run.then(() => {}, () => {});
  return run;
}

function rateLimited(error) {
  return /\b429\b/.test(String(error?.message || ''));
}

async function googleWithRetry(text, lang, attempts) {
  return withGoogleLock(async () => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const out = await engines.googleTranslate(text, lang);
        await sleep(350);
        return out;
      } catch (error) {
        console.warn(`[jobbot] google translate ${lang} failed (try ${attempt + 1}): ${safeError(error)}`);
        const giveUp = rateLimited(error) || attempt + 1 >= attempts;
        if (giveUp) {
          return null;
        }
        await sleep(2000 * (attempt + 1));
      }
    }
    return null;
  });
}

export async function tr(text, lang) {
  if (lang === 'en' || !text) {
    return text;
  }
  const db = getDatabase();
  const cached = db.prepare('SELECT out FROM tcache WHERE lang = ? AND src = ?').all(lang, text);
  if (cached.length) {
    return cached[0].out;
  }
  let out = null;
  if (NLLB_CODES[lang] && config.translator !== 'google') {
    try {
      out = await engines.nllbTranslate(text, lang);
    } catch (error) {
      if (error?.message !== 'nllb off') {
        console.warn(`[jobbot] nllb failed: ${safeError(error)}`);
      }
    }
  }
  if (!out) {
    const attempts = ADDIS_TRANSLATE.has(lang) ? 1 : 3;
    out = await googleWithRetry(text, lang, attempts);
  }
  if (!out && ADDIS_TRANSLATE.has(lang) && config.addisKey) {
    if (!announcedAddis) {
      announcedAddis = true;
      console.info('[jobbot] Google Translate failed. Using Addis AI.');
    }
    try {
      out = await engines.addisTranslate(text, lang);
    } catch (error) {
      if (error?.message !== 'addis translate off') {
        console.warn(`[jobbot] addis translate ${lang} failed: ${safeError(error)}`);
      }
    }
  }
  if (out) {
    db.prepare('INSERT OR REPLACE INTO tcache (lang, src, out) VALUES (?, ?, ?)').run(lang, text, out);
    return out;
  }
  return text;
}
