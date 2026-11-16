import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase, useDatabase } from '../src/db.js';
import {
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
