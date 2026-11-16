import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { CHOOSE_TEXT, P_DONE, P_MODE } from '../src/data/catalog.js';
import { getDatabase, getUser, openDatabase, setField, unseenJobs, useDatabase } from '../src/db.js';
import { handleCategoryChoice, handleLanguageChoice, handleModeChoice } from '../src/handlers/callbacks.js';
import { handleHelp, handleJobs, handleLinkedin, handleStart, handleStop } from '../src/handlers/commands.js';
import { linkedinLines } from '../src/keyboards/keyboards.js';
import { broadcast } from '../src/services/broadcast.js';
import { useVoiceMaker } from '../src/services/delivery.js';
import { getJobs, resetJobCache, useJobFetcher } from '../src/services/jobs.js';
import { resetTranslationState, setTranslators } from '../src/services/translate.js';
import { useSleep } from '../src/utils/sleep.js';
import { parseArgs } from '../src/bot.js';

const sampleJobs = [
  {
    title: 'Senior Software Engineer',
    link: 'https://example.com/jobs/senior-software-engineer',
    source: 'EthioJobs',
    cats: ['it', 'eng'],
  },
  {
    title: 'Nurse',
    link: 'https://example.com/jobs/nurse-officer',
    source: 'Ezega',
    cats: ['health'],
  },
];

function createCtx(overrides = {}) {
  const ctx = {
    chat: { id: 42, type: 'private' },
    replies: [],
    edits: [],
    markups: [],
    acked: false,
    sent: [],
    async answerCbQuery() {
      ctx.acked = true;
    },
    async reply(text, extra) {
      ctx.replies.push({ text, extra });
    },
    async editMessageText(text) {
      ctx.edits.push(text);
    },
    async editMessageReplyMarkup(markup) {
      ctx.markups.push(markup);
    },
    telegram: {
      async sendMessage(chatId, text, extra) {
        ctx.sent.push({ chatId, text, extra, kind: 'text' });
      },
      async sendAudio(chatId, file, extra) {
        ctx.sent.push({ chatId, file, extra, kind: 'audio' });
      },
      async sendChatAction() {},
    },
  };
  return Object.assign(ctx, overrides);
}

beforeEach(() => {
  process.env.TRANSLATOR = 'google';
  resetTranslationState();
  setTranslators({
    nllbTranslate: async () => {
      throw new Error('nllb off');
    },
    googleTranslate: async (text) => text,
  });
  useSleep(async () => {});
  useDatabase(openDatabase(':memory:'));
  resetJobCache();
  useJobFetcher(async () => sampleJobs.map((job) => ({ ...job, cats: [...job.cats] })));
  useVoiceMaker(async () => Buffer.from('voice'));
});

test('start subscribes the chat and shows six languages', async () => {
  const ctx = createCtx();
  await handleStart(ctx);
  assert.equal(ctx.replies[0].text, CHOOSE_TEXT);
  assert.equal(getUser(getDatabase(), 42).lang, 'en');
  const codes = ctx.replies[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.deepEqual(codes, ['lang:am', 'lang:en', 'lang:om', 'lang:ar', 'lang:so', 'lang:ti']);
});

test('language, access mode, and categories follow the setup order', async () => {
  const ctx = createCtx();
  await handleStart(ctx);
  ctx.callbackQuery = { data: 'lang:am' };
  await handleLanguageChoice(ctx);
  assert.equal(ctx.acked, true);
  assert.equal(getUser(getDatabase(), 42).lang, 'am');
  assert.equal(ctx.edits[0], '🇪🇹 አማርኛ ✅');
  assert.equal(ctx.sent[0].text, P_MODE);
  assert.deepEqual(
    ctx.sent[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data),
    ['mode:std', 'mode:blind', 'mode:deaf'],
  );

  ctx.callbackQuery = { data: 'mode:blind' };
  await handleModeChoice(ctx);
  assert.equal(getUser(getDatabase(), 42).mode, 'blind');

  ctx.callbackQuery = { data: 'cat:it' };
  await handleCategoryChoice(ctx);
  assert.deepEqual(getUser(getDatabase(), 42).cats, ['it']);
  const selected = ctx.markups.at(-1).inline_keyboard.flat().find((button) => button.callback_data === 'cat:it');
  assert.equal(selected.text.startsWith('✅ '), true);

  ctx.callbackQuery = { data: 'cat:it' };
  await handleCategoryChoice(ctx);
  assert.deepEqual(getUser(getDatabase(), 42).cats, []);

  ctx.callbackQuery = { data: 'cat:it' };
  await handleCategoryChoice(ctx);
  ctx.callbackQuery = { data: 'cat:done' };
  await handleCategoryChoice(ctx);
  assert.match(ctx.edits.at(-1), /IT & Software/);
  assert.equal(ctx.sent.some((message) => message.text === P_DONE), true);
  assert.equal(ctx.sent.some((message) => message.text?.includes('Senior Software Engineer')), true);
  assert.equal(ctx.sent.some((message) => message.text?.includes('Nurse')), false);
  assert.equal(ctx.sent.some((message) => message.kind === 'audio'), true);
});

test('jobs without a category filter include every current listing', async () => {
  const ctx = createCtx({ chat: { id: 7 } });
  await handleJobs(ctx);
  const text = ctx.sent.map((message) => message.text || '').join('\n');
  assert.match(text, /Senior Software Engineer/);
  assert.match(text, /Nurse/);
  assert.equal(ctx.sent.some((message) => message.kind === 'audio'), false);
});

test('an empty scrape tells the user to wait', async () => {
  useJobFetcher(async () => []);
  resetJobCache();
  const ctx = createCtx({ chat: { id: 8 } });
  await handleJobs(ctx);
  assert.match(ctx.sent[0].text, /No matching jobs right now/);
});

test('linkedin links use the selected categories', async () => {
  setField(getDatabase(), 42, 'lang', 'en');
  setField(getDatabase(), 42, 'cats', 'it,health');
  const ctx = createCtx();
  await handleLinkedin(ctx);
  assert.match(ctx.replies[0].text, /software\+developer/);
  assert.match(ctx.replies[0].text, /keywords=nurse/);
  assert.match(ctx.replies[0].text, /location=Ethiopia/);
  assert.deepEqual(linkedinLines([]), [
    'jobs: https://www.linkedin.com/jobs/search/?keywords=jobs&location=Ethiopia',
  ]);
});

test('help lists the commands and stop removes the subscriber', async () => {
  const ctx = createCtx();
  await handleStart(ctx);
  await handleHelp(ctx);
  assert.match(ctx.replies.at(-1).text, /\/jobs - Show the latest jobs now/);
  await handleStop(ctx);
  assert.equal(getUser(getDatabase(), 42), null);
  assert.match(ctx.replies.at(-1).text, /Unsubscribed/);
});

test('broadcast sends each person their new jobs once', async () => {
  const db = getDatabase();
  setField(db, 1, 'lang', 'en');
  setField(db, 1, 'cats', 'it');
  setField(db, 2, 'lang', 'en');
  setField(db, 2, 'mode', 'blind');
  let voices = 0;
  useVoiceMaker(async () => {
    voices += 1;
    return Buffer.from('voice');
  });
  const sent = [];
  const telegram = {
    async sendMessage(chatId, text) {
      sent.push({ chatId, text, kind: 'text' });
    },
    async sendAudio(chatId) {
      sent.push({ chatId, kind: 'audio' });
    },
  };
  await broadcast(telegram);
  assert.equal(sent.some((message) => message.chatId === 1 && message.text?.includes('Senior Software Engineer')), true);
  assert.equal(sent.some((message) => message.chatId === 1 && message.text?.includes('Nurse')), false);
  assert.equal(sent.some((message) => message.chatId === 2 && message.text?.includes('Nurse')), true);
  assert.equal(sent.filter((message) => message.kind === 'audio').length, 1);
  assert.equal(voices, 1);
  const before = sent.length;
  await broadcast(telegram);
  assert.equal(sent.length, before);
  assert.equal(unseenJobs(db, sampleJobs).length, 0);
});

test('a blocked chat is removed and extra jobs stay marked as seen', async () => {
  const db = getDatabase();
  const many = Array.from({ length: 13 }, (_, index) => ({
    title: `Software Engineer ${index}`,
    link: `https://example.com/jobs/software-engineer-${index}`,
    source: 'EthioJobs',
    cats: ['it'],
  }));
  useJobFetcher(async () => many);
  resetJobCache();
  setField(db, 9, 'cats', 'it');
  const telegram = {
    async sendMessage() {
      const error = new Error('blocked');
      error.code = 403;
      throw error;
    },
    async sendAudio() {},
  };
  await broadcast(telegram);
  assert.equal(getUser(db, 9), null);
  assert.equal(unseenJobs(db, many).length, 0);
});

test('the job cache is reused until a refresh is requested', async () => {
  let calls = 0;
  useJobFetcher(async () => {
    calls += 1;
    return sampleJobs;
  });
  resetJobCache();
  await getJobs(600);
  await getJobs(600);
  assert.equal(calls, 1);
  await getJobs(-1);
  assert.equal(calls, 2);
});

test('command line flags select scrape, warmup, or the bot', () => {
  assert.deepEqual(parseArgs(['node', 'bot', '--test']), { command: 'test', name: '' });
  assert.deepEqual(parseArgs(['node', 'bot', '--test', 'geez']), { command: 'test', name: 'geez' });
  assert.deepEqual(parseArgs(['node', 'bot', '--warmup']), { command: 'warmup' });
  assert.deepEqual(parseArgs(['node', 'bot']), { command: 'bot' });
});
