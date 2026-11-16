import {
  CHOOSE_TEXT,
  HELP,
  P_CATS,
  P_MODE,
} from '../data/catalog.js';
import { getDatabase, getUser, setField, deleteUser } from '../db.js';
import { catKeyboard, languageKeyboard, linkedinLines, modeKeyboard } from '../keyboards/keyboards.js';
import { sendLatest } from '../services/delivery.js';
import { tr } from '../services/translate.js';

const previewOff = { link_preview_options: { is_disabled: true } };

export async function handleStart(ctx) {
  const chatId = ctx.chat.id;
  if (!getUser(getDatabase(), chatId)) {
    setField(getDatabase(), chatId, 'lang', 'en');
  }
  await ctx.reply(CHOOSE_TEXT, languageKeyboard());
}

export async function handleLanguage(ctx) {
  await ctx.reply(CHOOSE_TEXT, languageKeyboard());
}

export async function handleMode(ctx) {
  const user = getUser(getDatabase(), ctx.chat.id) || { lang: 'en' };
  await ctx.reply(await tr(P_MODE, user.lang), await modeKeyboard(user.lang));
}

export async function handleCategories(ctx) {
  const db = getDatabase();
  const chatId = ctx.chat.id;
  if (!getUser(db, chatId)) {
    setField(db, chatId, 'lang', 'en');
  }
  const user = getUser(db, chatId);
  await ctx.reply(await tr(P_CATS, user.lang), await catKeyboard(user.lang, user.cats));
}

export async function handleJobs(ctx) {
  const db = getDatabase();
  const chatId = ctx.chat.id;
  if (!getUser(db, chatId)) {
    setField(db, chatId, 'lang', 'en');
  }
  await sendLatest(ctx.telegram, chatId);
}

export async function handleHelp(ctx) {
  const user = getUser(getDatabase(), ctx.chat.id) || { lang: 'en' };
  const lines = [];
  for (const [command, description] of HELP) {
    lines.push(`${command} - ${await tr(description, user.lang)}`);
  }
  await ctx.reply(lines.join('\n'));
}

export async function handleLinkedin(ctx) {
  const user = getUser(getDatabase(), ctx.chat.id) || { lang: 'en', cats: [] };
  const intro = await tr('LinkedIn search links for Ethiopia:', user.lang);
  await ctx.reply(`${intro}\n\n${linkedinLines(user.cats).join('\n\n')}`, previewOff);
}

export async function handleStop(ctx) {
  deleteUser(getDatabase(), ctx.chat.id);
  await ctx.reply('Unsubscribed. Send /start to come back.');
}

export function registerCommands(bot) {
  bot.start(handleStart);
  bot.command('language', handleLanguage);
  bot.command('mode', handleMode);
  bot.command('categories', handleCategories);
  bot.command('jobs', handleJobs);
  bot.command('linkedin', handleLinkedin);
  bot.command('help', handleHelp);
  bot.command('stop', handleStop);
}
