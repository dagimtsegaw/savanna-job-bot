import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase, useDatabase } from '../src/db.js';
import {
  addisTranslate,
  resetTranslationState,
  resolveNllbModel,
  setTranslators,
  tr,
} from '../src/services/translate.js';
import { useSleep } from '../src/utils/sleep.js';

test('facebook NLLB model name maps to the Node package', () => {
  assert.equal(
    resolveNllbModel('facebook/nllb-200-distilled-600M'),
    'Xenova/nllb-200-distilled-600M',
  );
  assert.equal(resolveNllbModel('Xenova/custom'), 'Xenova/custom');
});

test('translations are cached and NLLB is preferred when it returns text', async () => {
  process.env.TRANSLATOR = 'auto';
  resetTranslationState();
  useDatabase(openDatabase(':memory:'));
  useSleep(async () => {});
  let nllbCalls = 0;
  let googleCalls = 0;
  setTranslators({
    nllbTranslate: async (text, lang) => {
      nllbCalls += 1;
      return `${lang}:${text}`;
    },
    googleTranslate: async () => {
      googleCalls += 1;
      return 'google';
    },
  });
  assert.equal(await tr('Nurse', 'en'), 'Nurse');
  assert.equal(await tr('Nurse', 'am'), 'am:Nurse');
  assert.equal(await tr('Nurse', 'am'), 'am:Nurse');
  assert.equal(nllbCalls, 1);
  assert.equal(googleCalls, 0);
});

test('Google is the backup when NLLB is off', async () => {
  process.env.TRANSLATOR = 'google';
  resetTranslationState();
  useDatabase(openDatabase(':memory:'));
  useSleep(async () => {});
  let calls = 0;
  setTranslators({
    googleTranslate: async (text, lang) => {
      calls += 1;
      return `${lang}:${text}`;
    },
  });
  assert.equal(await tr('Teacher', 'om'), 'om:Teacher');
  assert.equal(await tr('Teacher', 'om'), 'om:Teacher');
  assert.equal(calls, 1);
});

test('a Google 429 for Amharic uses Addis AI and then the cache', async () => {
  process.env.TRANSLATOR = 'google';
  resetTranslationState();
  useDatabase(openDatabase(':memory:'));
  useSleep(async () => {});
  let googleCalls = 0;
  let addisCalls = 0;
  setTranslators({
    googleTranslate: async () => {
      googleCalls += 1;
      throw new Error('google translate 429');
    },
    addisTranslate: async (text, lang) => {
      addisCalls += 1;
      return `${lang}:${text}`;
    },
  });
  assert.equal(await tr('Nurse', 'am'), 'am:Nurse');
  assert.equal(await tr('Nurse', 'am'), 'am:Nurse');
  assert.equal(googleCalls, 1);
  assert.equal(addisCalls, 1);
});

test('Arabic stays on Google when Addis does not translate it', async () => {
  process.env.TRANSLATOR = 'google';
  resetTranslationState();
  useDatabase(openDatabase(':memory:'));
  useSleep(async () => {});
  let addisCalls = 0;
  setTranslators({
    googleTranslate: async () => {
      throw new Error('google translate 429');
    },
    addisTranslate: async () => {
      addisCalls += 1;
      return 'should-not-run';
    },
  });
  assert.equal(await tr('Nurse', 'ar'), 'Nurse');
  assert.equal(addisCalls, 0);
});

test('Addis translation reads the translation field', async () => {
  const translated = await addisTranslate('Nurse', 'am', {
    key: 'test-key',
    base: 'https://api.addisassistant.com/api/v1',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.addisassistant.com/api/v1/translate');
      assert.equal(options.headers['x-api-key'], 'test-key');
      const body = JSON.parse(options.body);
      assert.deepEqual(body, {
        text: 'Nurse',
        source_language: 'en',
        target_language: 'am',
      });
      return {
        ok: true,
        async json() {
          return { status: 'success', data: { translation: 'ነርስ' } };
        },
      };
    },
  });
  assert.equal(translated, 'ነርስ');
  await assert.rejects(
    () => addisTranslate('Nurse', 'am', { key: '' }),
    /addis translate off/,
  );
});
