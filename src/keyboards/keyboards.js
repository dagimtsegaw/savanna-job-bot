import { Markup } from 'telegraf';
import { CATEGORIES, LANGS, LINKEDIN_KW, MODES } from '../data/catalog.js';
import { tr } from '../services/translate.js';

export function languageKeyboard() {
  const buttons = Object.entries(LANGS).map(([code, lang]) => (
    Markup.button.callback(`${lang.flag} ${lang.name}`, `lang:${code}`)
  ));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return Markup.inlineKeyboard(rows);
}

export async function modeKeyboard(lang) {
  const rows = [];
  for (const [key, mode] of Object.entries(MODES)) {
    rows.push([Markup.button.callback(`${mode.emoji} ${await tr(mode.label, lang)}`, `mode:${key}`)]);
  }
  return Markup.inlineKeyboard(rows);
}

export async function catKeyboard(lang, selected) {
  const buttons = [];
  for (const [key, category] of Object.entries(CATEGORIES)) {
    const mark = selected.includes(key) ? '✅ ' : '';
    buttons.push(Markup.button.callback(
      `${mark}${category.emoji} ${await tr(category.label, lang)}`,
      `cat:${key}`,
    ));
  }
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  rows.push([
    Markup.button.callback(`🌐 ${await tr('All jobs', lang)}`, 'cat:all'),
    Markup.button.callback(`✔️ ${await tr('Done', lang)}`, 'cat:done'),
  ]);
  return Markup.inlineKeyboard(rows);
}

export function quotePlus(value) {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

export function linkedinLines(cats) {
  const keys = (cats || []).filter((key) => LINKEDIN_KW[key]).slice(0, 5);
  const chosen = keys.length ? keys : [null];
  return chosen.map((key) => {
    const keyword = key ? LINKEDIN_KW[key] : 'jobs';
    return `${keyword}: https://www.linkedin.com/jobs/search/?keywords=${quotePlus(keyword)}&location=Ethiopia`;
  });
}
