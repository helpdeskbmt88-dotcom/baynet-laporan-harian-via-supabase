import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { databasePath } from './config.js';

if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
const client = new DatabaseSync(databasePath);
client.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON');
const active = new AsyncLocalStorage();
let pending = Promise.resolve();

// Reserve the connection across await points in a multi-step transaction.
function exclusive(fn) {
  if (active.getStore()) return fn();
  const operation = pending.then(() => active.run(true, fn));
  pending = operation.catch(() => {});
  return operation;
}

export const db = {
  all(sql, ...args) { return exclusive(() => client.prepare(sql).all(...args)); },
  get(sql, ...args) { return exclusive(() => client.prepare(sql).get(...args)); },
  run(sql, ...args) { return exclusive(() => client.prepare(sql).run(...args)); },
};

export function transaction(fn) {
  return exclusive(async () => {
    client.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      client.exec('COMMIT');
      return result;
    } catch (error) {
      client.exec('ROLLBACK');
      throw error;
    }
  });
}

if ((await db.get('PRAGMA user_version')).user_version === 0) {
  await transaction(async () => {
    if ((await db.get('PRAGMA user_version')).user_version !== 0) return;
    client.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL, division TEXT NOT NULL, role TEXT NOT NULL,
      review_divisions TEXT NOT NULL DEFAULT '[]', password_hash TEXT NOT NULL
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
    );
    CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL, shift TEXT NOT NULL CHECK(shift IN ('Pagi','Siang')),
      slot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
      activities TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(author_id, date, slot)
    );
    CREATE INDEX reports_date ON reports(date, status);
    CREATE TABLE history (
      id INTEGER PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      status TEXT NOT NULL, actor_id INTEGER NOT NULL REFERENCES users(id), note TEXT NOT NULL, at TEXT NOT NULL
    );
    CREATE INDEX history_report ON history(report_id);
    CREATE TABLE attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, content BLOB NOT NULL
    );
    CREATE INDEX attachments_report ON attachments(report_id);
    PRAGMA user_version = 1;
    `);
  });
}
