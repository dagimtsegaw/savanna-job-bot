import { DatabaseSync } from 'node:sqlite';

const FIELDS = new Set(['lang', 'cats', 'mode']);

// node:sqlite in Node 22.5 returns a null-filled object from get() when no row matches.
function one(statement, ...params) {
  const rows = statement.all(...params);
  return rows.length ? rows[0] : null;
}

let database = null;

export function migrate(db) {
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id INTEGER PRIMARY KEY,
      lang TEXT DEFAULT 'en',
      cats TEXT DEFAULT '',
      mode TEXT DEFAULT 'std'
    );
    CREATE TABLE IF NOT EXISTS seen (link TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS tcache (
      lang TEXT,
      src TEXT,
      out TEXT,
      PRIMARY KEY (lang, src)
    );
  `);
  for (const [column, ddl] of [
    ['lang', "TEXT DEFAULT 'en'"],
    ['cats', "TEXT DEFAULT ''"],
    ['mode', "TEXT DEFAULT 'std'"],
  ]) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${column} ${ddl}`);
    } catch (error) {
      if (!/duplicate column name/i.test(error.message)) {
        throw error;
      }
    }
  }
  return db;
}

export function openDatabase(file) {
  return migrate(new DatabaseSync(file));
}

export function useDatabase(db) {
  database = db;
  return db;
}

export function getDatabase() {
  if (!database) {
    throw new Error('Database is not open');
  }
  return database;
}

export function getUser(db, chatId) {
  const row = one(db.prepare('SELECT lang, cats, mode FROM users WHERE chat_id = ?'), chatId);
  if (!row) {
    return null;
  }
  return {
    lang: row.lang || 'en',
    cats: String(row.cats || '').split(',').filter(Boolean),
    mode: row.mode || 'std',
  };
}

export function setField(db, chatId, field, value) {
  if (!FIELDS.has(field)) {
    throw new Error(`Unknown user field: ${field}`);
  }
  db.prepare(
    `INSERT INTO users (chat_id, ${field}) VALUES (?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET ${field} = excluded.${field}`,
  ).run(chatId, value);
}

export function deleteUser(db, chatId) {
  db.prepare('DELETE FROM users WHERE chat_id = ?').run(chatId);
}

export function listChatIds(db) {
  return db.prepare('SELECT chat_id FROM users').all().map((row) => row.chat_id);
}

export function unseenJobs(db, jobs) {
  const seen = new Set(db.prepare('SELECT link FROM seen').all().map((row) => row.link));
  return jobs.filter((job) => !seen.has(job.link));
}

export function markSeen(db, jobs) {
  if (!jobs.length) {
    return;
  }
  const insert = db.prepare('INSERT OR IGNORE INTO seen (link) VALUES (?)');
  db.exec('BEGIN');
  try {
    for (const job of jobs) {
      insert.run(job.link);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
