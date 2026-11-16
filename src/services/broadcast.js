import { config } from '../config.js';
import {
  deleteUser,
  getDatabase,
  getUser,
  listChatIds,
  markSeen,
  unseenJobs,
} from '../db.js';
import { sleep } from '../utils/sleep.js';
import { safeError } from '../utils/safeLog.js';
import { getJobs } from './jobs.js';
import { matches } from './scraper.js';
import { sendJobs } from './delivery.js';

export function isBlocked(error) {
  return error?.response?.error_code === 403 || error?.code === 403;
}

export async function broadcast(telegram) {
  const db = getDatabase();
  const users = listChatIds(db);
  if (users.length === 0) {
    return;
  }
  let jobs;
  try {
    jobs = await getJobs(0);
  } catch (error) {
    console.error(`[jobbot] fetch failed: ${safeError(error)}`);
    return;
  }
  const fresh = unseenJobs(db, jobs);
  if (fresh.length === 0) {
    console.log('[jobbot] no new jobs');
    return;
  }
  console.log(`[jobbot] ${fresh.length} new jobs`);
  const vcache = new Map();
  for (const chatId of users) {
    const user = getUser(db, chatId);
    if (!user) {
      continue;
    }
    const mine = fresh.filter((job) => matches(job, user.cats)).slice(0, config.maxPerRun);
    if (mine.length > 0) {
      try {
        await sendJobs(telegram, chatId, user, mine, 'New opportunities', vcache);
      } catch (error) {
        if (isBlocked(error)) {
          deleteUser(db, chatId);
        } else {
          console.warn(`[jobbot] send to ${chatId} failed: ${safeError(error)}`);
        }
      }
    }
    await sleep(50);
  }
  markSeen(db, fresh);
}
