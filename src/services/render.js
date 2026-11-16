import { tr } from './translate.js';

const EMOJI = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B50\u2B06\uFE0F\u200D]/gu;

export function pack(blocks, sep = '\n\n', limit = 3800) {
  const messages = [];
  let current = '';
  for (const block of blocks) {
    if (current && current.length + sep.length + block.length > limit) {
      messages.push(current);
      current = block;
    } else {
      current = current ? `${current}${sep}${block}` : block;
    }
  }
  if (current) {
    messages.push(current);
  }
  return messages;
}

export async function renderJobs(jobs, lang, mode, header, translate = tr) {
  const titles = [];
  for (const job of jobs) {
    titles.push(await translate(job.title, lang));
  }
  const head = await translate(header, lang);
  const count = jobs.length;
  if (mode === 'blind') {
    const jobLabel = await translate('Job', lang);
    const sourceLabel = await translate('Source', lang);
    const linkLabel = await translate('Link', lang);
    const blocks = [`${head}. ${count}.`];
    titles.forEach((title, index) => {
      const job = jobs[index];
      blocks.push(`${jobLabel} ${index + 1}/${count}: ${title}\n${sourceLabel}: ${job.source}\n${linkLabel}: ${job.link}`);
    });
    return pack(blocks).map((message) => message.replace(EMOJI, ''));
  }
  if (mode === 'deaf') {
    const blocks = [`📢 ${head}`];
    titles.forEach((title, index) => {
      const job = jobs[index];
      blocks.push(`📌 ${title}\n🏢 ${job.source}\n👉 ${job.link}`);
    });
    return pack(blocks, '\n\n➖➖➖\n\n');
  }
  const blocks = [`🆕 ${head}`];
  titles.forEach((title, index) => {
    const job = jobs[index];
    blocks.push(`• ${title} (${job.source})\n${job.link}`);
  });
  return pack(blocks);
}
