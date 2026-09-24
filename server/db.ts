import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { config } from './config.ts'
import type { Settings } from '../shared/types.ts'

fs.mkdirSync(config.dataDir, { recursive: true })

export const db = new DatabaseSync(process.env.DB_PATH ?? path.join(config.dataDir, 'planner.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    label TEXT NOT NULL,
    credentials TEXT NOT NULL DEFAULT '{}',
    last_error TEXT,
    last_synced_at TEXT
  );

  CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    remote_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    person TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    writable INTEGER NOT NULL DEFAULT 1,
    UNIQUE (account_id, remote_id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    remote_id TEXT NOT NULL,
    etag TEXT,
    title TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    all_day INTEGER NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    recurring INTEGER NOT NULL DEFAULT 0,
    raw TEXT
  );
  CREATE INDEX IF NOT EXISTS events_range ON events (start, end);

  CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS list_items (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    done_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

export const newId = () => randomUUID()

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export const defaultSettings: Settings = {
  idleSeconds: 120,
  artSeconds: 300,
  artClock: true,
  artSource: 'aic',
  artQuery: 'landscape',
  nightStart: '22:30',
  nightEnd: '06:00',
  setupDone: false,
}

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const stored = Object.fromEntries(rows.filter((r) => r.key in defaultSettings).map((r) => [r.key, JSON.parse(r.value)]))
  return { ...defaultSettings, ...stored }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  transaction(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (key in defaultSettings) stmt.run(key, JSON.stringify(value))
    }
  })
  return getSettings()
}

/** First run: a built-in "Home" calendar and the everyday lists, so the screen is useful before any account is connected. */
export function seed() {
  const hasAccounts = db.prepare('SELECT 1 FROM accounts LIMIT 1').get()
  if (!hasAccounts) {
    const accountId = newId()
    db.prepare("INSERT INTO accounts (id, provider, label) VALUES (?, 'local', 'This screen')").run(accountId)
    db.prepare("INSERT INTO calendars (id, account_id, remote_id, name, color, person) VALUES (?, ?, 'home', 'Home', '#7c8b6f', 'Home')").run(newId(), accountId)
  }
  const hasLists = db.prepare('SELECT 1 FROM lists LIMIT 1').get()
  if (!hasLists) {
    const insert = db.prepare('INSERT INTO lists (id, name, icon, sort) VALUES (?, ?, ?, ?)')
    ;[['Shopping', '🛒'], ['To do', '✓'], ['To buy', '🏷'], ['Meals', '🍽']].forEach(([name, icon], i) => insert.run(newId(), name, icon, i))
  }
}
