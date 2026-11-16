import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';
import {
  getUser,
  markSeen,
  migrate,
  openDatabase,
  setField,
  unseenJobs,
} from '../src/db.js';

test('user fields update independently', () => {
  const db = openDatabase(':memory:');
  setField(db, 5, 'lang', 'ti');
  setField(db, 5, 'cats', 'it,logi');
  setField(db, 5, 'mode', 'blind');
  setField(db, 5, 'lang', 'am');
  assert.deepEqual(getUser(db, 5), { lang: 'am', cats: ['it', 'logi'], mode: 'blind' });
  assert.equal(getUser(db, 99), null);
  assert.throws(() => setField(db, 5, 'token', 'nope'));
});

test('seen links are ignored on the next broadcast', () => {
  const db = openDatabase(':memory:');
  const jobs = [
    { link: 'https://example.com/a' },
    { link: 'https://example.com/b' },
  ];
  assert.equal(unseenJobs(db, jobs).length, 2);
  markSeen(db, jobs.slice(0, 1));
  assert.deepEqual(unseenJobs(db, jobs).map((job) => job.link), ['https://example.com/b']);
});

test('older databases gain the language, category, and mode columns', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users (chat_id INTEGER PRIMARY KEY)');
  migrate(db);
  setField(db, 3, 'mode', 'deaf');
  assert.deepEqual(getUser(db, 3), { lang: 'en', cats: [], mode: 'deaf' });
});

test('the current bot.db subscribers stay readable', () => {
  if (!fs.existsSync(config.dbPath)) {
    return;
  }
  const copy = path.join(os.tmpdir(), `savanna-job-bot-${process.pid}-copy.db`);
  fs.copyFileSync(config.dbPath, copy);
  const db = openDatabase(copy);
  assert.deepEqual(getUser(db, 1474273823), { lang: 'am', cats: ['it'], mode: 'std' });
  const seen = db.prepare('SELECT COUNT(*) AS n FROM seen').all()[0];
  assert.ok(seen.n >= 143);
  db.close();
  try {
    fs.rmSync(copy, { force: true });
  } catch {
    // Windows can keep the sqlite file locked until the process exits.
  }
});
