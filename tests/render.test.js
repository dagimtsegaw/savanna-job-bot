import assert from 'node:assert/strict';
import test from 'node:test';
import { pack, renderJobs } from '../src/services/render.js';

const identity = async (text) => text;
const jobs = [
  { title: 'Nurse 🏥', link: 'https://example.com/nurse', source: 'Ezega' },
];

test('pack keeps blocks together until the next one would pass the limit', () => {
  assert.deepEqual(pack(['aaaa', 'bbbb', 'cccc'], '\n\n', 10), ['aaaa\n\nbbbb', 'cccc']);
});

test('blind mode is plain text with the job count and no emoji', async () => {
  const messages = await renderJobs(jobs, 'en', 'blind', 'Latest jobs right now', identity);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].includes('🏥'), false);
  assert.match(messages[0], /^Latest jobs right now\. 1\./);
  assert.match(messages[0], /Job 1\/1: Nurse/);
  assert.match(messages[0], /Source: Ezega/);
  assert.match(messages[0], /Link: https:\/\/example\.com\/nurse/);
});

test('deaf mode keeps the short visual card', async () => {
  const [message] = await renderJobs(jobs, 'en', 'deaf', 'Latest jobs right now', identity);
  assert.match(message, /📢 Latest jobs right now/);
  assert.match(message, /📌 Nurse 🏥/);
  assert.match(message, /🏢 Ezega/);
  assert.match(message, /👉 https:\/\/example\.com\/nurse/);
});

test('standard mode lists the title, source, and link', async () => {
  const [message] = await renderJobs(jobs, 'en', 'std', 'New opportunities', identity);
  assert.match(message, /🆕 New opportunities/);
  assert.match(message, /• Nurse 🏥 \(Ezega\)\nhttps:\/\/example\.com\/nurse/);
});
