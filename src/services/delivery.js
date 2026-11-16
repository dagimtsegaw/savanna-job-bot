import { config } from '../config.js';
import { getDatabase, getUser } from '../db.js';
import { matches } from './scraper.js';
import { getJobs } from './jobs.js';
import { makeVoice as defaultMakeVoice } from './speech.js';
import { renderJobs } from './render.js';
import { tr } from './translate.js';

const previewOff = { link_preview_options: { is_disabled: true } };
let makeVoice = defaultMakeVoice;

export function useVoiceMaker(fn) {
  makeVoice = fn;
}

export async function sendJobs(telegram, chatId, user, jobs, header, vcache = null) {
  const messages = await renderJobs(jobs, user.lang, user.mode, header);
  for (const text of messages) {
    await telegram.sendMessage(chatId, text, previewOff);
  }
  if (user.mode !== 'blind') {
    return;
  }
  const key = `${user.lang}\n${jobs.map((job) => job.link).join('\n')}`;
  let audio;
  if (vcache && vcache.has(key)) {
    audio = vcache.get(key);
  } else {
    audio = await makeVoice(jobs, user.lang);
    if (vcache) {
      vcache.set(key, audio);
    }
  }
  if (audio?.length) {
    await telegram.sendAudio(chatId, { source: audio, filename: 'jobs.mp3' }, { title: 'Jobs' });
  }
}

export async function sendLatest(telegram, chatId) {
  const user = getUser(getDatabase(), chatId);
  if (!user) {
    return;
  }
  await telegram.sendChatAction(chatId, 'typing');
  const jobs = (await getJobs()).filter((job) => matches(job, user.cats)).slice(0, config.instantCount);
  if (jobs.length === 0) {
    await telegram.sendMessage(
      chatId,
      await tr('No matching jobs right now. I will message you when new ones appear.', user.lang),
    );
    return;
  }
  await sendJobs(telegram, chatId, user, jobs, 'Latest jobs right now');
}
