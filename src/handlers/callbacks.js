import { CATEGORIES, LANGS, MODES, P_CATS, P_DONE, P_MODE } from '../data/catalog.js';
import { getDatabase, getUser, setField } from '../db.js';
import { catKeyboard, modeKeyboard } from '../keyboards/keyboards.js';
import { sendLatest } from '../services/delivery.js';
import { tr } from '../services/translate.js';

export async function handleLanguageChoice(ctx) {
  await ctx.answerCbQuery();
  const code = ctx.callbackQuery.data.split(':')[1];
  if (!LANGS[code]) {
    return;
  }
  const chatId = ctx.chat.id;
  setField(getDatabase(), chatId, 'lang', code);
  const lang = LANGS[code];
  await ctx.editMessageText(`${lang.flag} ${lang.name} ✅`);
  await ctx.telegram.sendMessage(chatId, await tr(P_MODE, code), await modeKeyboard(code));
}

export async function handleModeChoice(ctx) {
  await ctx.answerCbQuery();
  const key = ctx.callbackQuery.data.split(':')[1];
  if (!MODES[key]) {
    return;
  }
  const chatId = ctx.chat.id;
  const db = getDatabase();
  setField(db, chatId, 'mode', key);
  const user = getUser(db, chatId);
  const mode = MODES[key];
  await ctx.editMessageText(`${mode.emoji} ${await tr(mode.label, user.lang)} ✅`);
  await ctx.telegram.sendMessage(chatId, await tr(P_CATS, user.lang), await catKeyboard(user.lang, user.cats));
}

export async function handleCategoryChoice(ctx) {
  await ctx.answerCbQuery();
  const key = ctx.callbackQuery.data.slice('cat:'.length);
  const chatId = ctx.chat.id;
  const db = getDatabase();
  if (!getUser(db, chatId)) {
    setField(db, chatId, 'lang', 'en');
  }
  const user = getUser(db, chatId);
  let cats = [...user.cats];
  if (key === 'done') {
    const names = cats.length
      ? (await Promise.all(cats.map((cat) => tr(CATEGORIES[cat].label, user.lang)))).join(', ')
      : await tr('All jobs', user.lang);
    await ctx.editMessageText(`✅ ${names}`);
    await ctx.telegram.sendMessage(chatId, await tr(P_DONE, user.lang));
    await sendLatest(ctx.telegram, chatId);
    return;
  }
  if (key === 'all') {
    cats = [];
  } else if (CATEGORIES[key]) {
    cats = cats.includes(key) ? cats.filter((cat) => cat !== key) : [...cats, key];
  }
  setField(db, chatId, 'cats', cats.join(','));
  const markup = await catKeyboard(user.lang, cats);
  await ctx.editMessageReplyMarkup(markup.reply_markup);
}

export function registerCallbacks(bot) {
  bot.action(/^lang:/, handleLanguageChoice);
  bot.action(/^mode:/, handleModeChoice);
  bot.action(/^cat:/, handleCategoryChoice);
}
