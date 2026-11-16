import assert from 'node:assert/strict';
import test from 'node:test';
import { addisSpeak, makeVoice, spokenJobs } from '../src/services/speech.js';

const jobs = [{ title: 'Nurse', link: 'https://example.com/nurse' }];
const identity = async (text) => text;

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    async json() {
      return body;
    },
  };
}

test('spoken job text lists translated titles', async () => {
  const text = await spokenJobs(jobs, 'am', async (value) => `am:${value}`);
  assert.equal(text, 'am:New jobs. am:Job 1. am:Nurse');
});

test('Addis audio is downloaded from the returned url', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    if (String(url).includes('/voices')) {
      return jsonResponse([{ id: 'am-test', is_available: true }]);
    }
    if (String(url).includes('/generations')) {
      return jsonResponse({ audio_url: 'https://cdn.example/a.mp3' });
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'audio/mpeg' },
      async arrayBuffer() {
        return Uint8Array.from([1, 2, 3]).buffer;
      },
    };
  };
  const audio = await addisSpeak('Hello', 'am', {
    key: 'test-key',
    fetchImpl,
    base: 'https://api.addisassistant.com/api/v1',
    cache: new Map(),
  });
  assert.deepEqual([...audio], [1, 2, 3]);
  assert.equal(urls[0].startsWith('https://api.addisassistant.com/api/v1/voice/voices'), true);
});

test('a missing Addis key produces no audio', async () => {
  const audio = await addisSpeak('Hello', 'am', { key: '', fetchImpl: async () => { throw new Error('called'); } });
  assert.equal(audio, null);
});

test('Amharic falls back to the Amharic Edge voice', async () => {
  const calls = [];
  const audio = await makeVoice(jobs, 'am', {
    tr: identity,
    addisSpeak: async () => null,
    edgeSpeak: async (text, voice) => {
      calls.push({ text, voice });
      return Buffer.from('mp3');
    },
  });
  assert.equal(audio.toString(), 'mp3');
  assert.equal(calls[0].voice, 'am-ET-MekdesNeural');
  assert.equal(calls[0].text, 'New jobs. Job 1. Nurse');
});

test('Oromo and Tigrinya fall back to an English reading', async () => {
  const calls = [];
  await makeVoice(jobs, 'om', {
    tr: async (text) => `om:${text}`,
    addisSpeak: async () => null,
    edgeSpeak: async (text, voice) => {
      calls.push({ text, voice });
      return Buffer.from('mp3');
    },
  });
  assert.equal(calls[0].voice, 'en-US-AriaNeural');
  assert.equal(calls[0].text, 'New jobs. Job 1. Nurse');
});

test('English stays on Edge', async () => {
  let addisCalled = false;
  const calls = [];
  await makeVoice(jobs, 'en', {
    tr: identity,
    addisSpeak: async () => {
      addisCalled = true;
      return Buffer.from('no');
    },
    edgeSpeak: async (text, voice) => {
      calls.push({ text, voice });
      return Buffer.from('mp3');
    },
  });
  assert.equal(addisCalled, false);
  assert.equal(calls[0].voice, 'en-US-AriaNeural');
});
