import { config } from '../config.js';
import { ADDIS_LANGS, ADDIS_VOICES, EDGE_VOICES } from '../data/catalog.js';
import { safeError } from '../utils/safeLog.js';
import { tr } from './translate.js';

const voiceCache = new Map();

export async function spokenJobs(jobs, lang, translate = tr) {
  const titles = [];
  for (const job of jobs) {
    titles.push(await translate(job.title, lang));
  }
  const intro = await translate('New jobs', lang);
  const word = await translate('Job', lang);
  const parts = [intro, ...titles.map((title, index) => `${word} ${index + 1}. ${title}`)];
  return parts.join('. ').slice(0, 1500);
}

export async function makeVoice(jobs, lang, options = {}) {
  const translate = options.tr || tr;
  const addis = options.addisSpeak || ((text, language) => addisSpeak(text, language, options));
  const edge = options.edgeSpeak || edgeSpeak;
  if (ADDIS_LANGS.has(lang)) {
    const audio = await addis(await spokenJobs(jobs, lang, translate), lang);
    if (audio?.length) {
      return audio;
    }
    console.info(`[jobbot] addis voice unavailable for ${lang}, using the Edge fallback`);
  }
  if (EDGE_VOICES[lang]) {
    return edge(await spokenJobs(jobs, lang, translate), EDGE_VOICES[lang]);
  }
  const titles = jobs.map((job) => job.title);
  const text = ['New jobs', ...titles.map((title, index) => `Job ${index + 1}. ${title}`)].join('. ').slice(0, 1500);
  return edge(text, EDGE_VOICES.en);
}

export async function addisSpeak(text, lang, options = {}) {
  const key = options.key ?? config.addisKey;
  if (!key || !ADDIS_LANGS.has(lang) || !text) {
    return null;
  }
  const fetchImpl = options.fetchImpl || fetch;
  const base = joinBase(options.base ?? config.addisBase);
  const cache = options.cache || voiceCache;
  try {
    const voiceId = await chooseVoice(lang, { ...options, key, fetchImpl, base, cache });
    if (!voiceId) {
      console.warn(`[jobbot] addis has no voice for ${lang}`);
      return null;
    }
    const response = await fetchImpl(`${base}/api/v1/voice/generations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        text: text.slice(0, 1500),
        voice_id: voiceId,
        language: lang,
        output_format: 'mp3_44100',
        client_request_id: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 20000),
    });
    const type = header(response, 'content-type');
    if (response.ok && /audio\/|octet-stream/i.test(type)) {
      const bytes = Buffer.from(await response.arrayBuffer());
      return bytes.length ? bytes : null;
    }
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const ref = audioRef(body);
    if (ref.startsWith('data:')) {
      return bytesFromDataUrl(ref);
    }
    if (ref.startsWith('http://') || ref.startsWith('https://')) {
      const audio = await fetchImpl(ref, { signal: AbortSignal.timeout(options.timeoutMs || 20000) });
      if (responseOk(audio)) {
        const bytes = Buffer.from(await audio.arrayBuffer());
        return bytes.length ? bytes : null;
      }
    }
  } catch (error) {
    console.warn(`[jobbot] addis voice failed: ${safeError(error)}`);
  }
  return null;
}

async function chooseVoice(lang, options) {
  const hit = options.cache.get(lang);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) {
    return hit.id;
  }
  let voiceId = ADDIS_VOICES[lang] || '';
  try {
    const response = await options.fetchImpl(
      `${options.base}/api/v1/voice/voices?language=${encodeURIComponent(lang)}`,
      {
        headers: { 'x-api-key': options.key, accept: 'application/json' },
        signal: AbortSignal.timeout(options.timeoutMs || 20000),
      },
    );
    if (responseOk(response)) {
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      const found = firstVoice(body);
      if (found) {
        voiceId = found;
      }
    }
  } catch (error) {
    console.warn(`[jobbot] addis voice list failed: ${safeError(error)}`);
  }
  if (!voiceId) {
    return '';
  }
  options.cache.set(lang, { id: voiceId, at: Date.now() });
  return voiceId;
}

function firstVoice(body) {
  const rows = asList(body);
  for (const entry of rows) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    if (entry.is_available === false || entry.isAvailable === false) {
      continue;
    }
    const voiceId = entry.id || entry.voice_id || entry.voiceId;
    if (typeof voiceId === 'string' && voiceId.trim()) {
      return voiceId.trim();
    }
  }
  return '';
}

function asList(body) {
  if (Array.isArray(body)) {
    return body;
  }
  if (!body || typeof body !== 'object') {
    return [];
  }
  if (Array.isArray(body.data)) {
    return body.data;
  }
  if (Array.isArray(body.voices)) {
    return body.voices;
  }
  if (body.data && Array.isArray(body.data.voices)) {
    return body.data.voices;
  }
  return [];
}

function audioRef(body) {
  if (!body || typeof body !== 'object') {
    return '';
  }
  for (const pile of [body, body.data, body.clip]) {
    if (!pile || typeof pile !== 'object' || Array.isArray(pile)) {
      continue;
    }
    for (const key of ['audio_url', 'audioUrl', 'url']) {
      const value = pile[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }
  return '';
}

function bytesFromDataUrl(ref) {
  const match = ref.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) {
    return null;
  }
  const bytes = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(match[3], 'utf8');
  return bytes.length ? bytes : null;
}

function joinBase(value) {
  let root = String(value || 'https://api.addisassistant.com').trim().replace(/\/$/, '');
  if (root.endsWith('/api/v1')) {
    root = root.slice(0, -'/api/v1'.length);
  }
  return root || 'https://api.addisassistant.com';
}

function header(response, name) {
  if (!response?.headers || typeof response.headers.get !== 'function') {
    return '';
  }
  return response.headers.get(name) || '';
}

function responseOk(response) {
  return response?.ok === true || response?.status === 200;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function edgeSpeak(text, voice) {
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 30000 });
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(xmlEscape(text));
      const chunks = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audio = Buffer.concat(chunks);
      return audio.length ? audio : null;
    } finally {
      tts.close();
    }
  } catch (error) {
    console.warn(`[jobbot] edge voice failed: ${safeError(error)}`);
    return null;
  }
}
