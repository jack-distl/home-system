import { config } from './config.ts'
import { db, newId, transaction } from './db.ts'
import { CalDavProvider, type CalDavCredentials } from './providers/caldav.ts'
import { GoogleProvider, type GoogleCredentials } from './providers/google.ts'
import { LocalProvider } from './providers/local.ts'
import { ProviderError, type EventFields, type Provider, type RemoteEvent } from './providers/types.ts'
import type { CalendarEvent, EventInput, ProviderKind } from '../shared/types.ts'

interface AccountRow {
  id: string
  provider: ProviderKind
  label: string
  credentials: string
}

interface EventRow {
  id: string
  calendar_id: string
  remote_id: string
  etag: string | null
  title: string
  start: string
  end: string
  all_day: number
  location: string
  notes: string
  recurring: number
  raw: string | null
}

// Providers hold connections and tokens, so keep one per account.
const providers = new Map<string, Provider>()

function providerFor(accountId: string): Provider {
  const cached = providers.get(accountId)
  if (cached) return cached
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as AccountRow | undefined
  if (!account) throw new ProviderError('Account not found', 404)
  const creds = JSON.parse(account.credentials)
  let provider: Provider
  if (account.provider === 'google') {
    provider = new GoogleProvider(creds as GoogleCredentials, (updated) =>
      db.prepare('UPDATE accounts SET credentials = ? WHERE id = ?').run(JSON.stringify(updated), accountId),
    )
  } else if (account.provider === 'caldav') {
    provider = new CalDavProvider(creds as CalDavCredentials)
  } else {
    provider = new LocalProvider()
  }
  providers.set(accountId, provider)
  return provider
}

export function forgetProvider(accountId: string) {
  providers.delete(accountId)
}

function syncWindow() {
  const day = 24 * 60 * 60 * 1000
  return { from: new Date(Date.now() - config.syncPastDays * day), to: new Date(Date.now() + config.syncFutureDays * day) }
}

const PALETTE = ['#4a7fb5', '#b5654a', '#7c8b6f', '#9a6fb0', '#c49a3a', '#4f9a94', '#b0506f']

/** Pull the calendar list and all events in the sync window for one account, replacing the local cache. */
export async function syncAccount(accountId: string) {
  const provider = providerFor(accountId)
  try {
    const remoteCalendars = await provider.listCalendars()
    const existing = db.prepare('SELECT id, remote_id FROM calendars WHERE account_id = ?').all(accountId) as { id: string; remote_id: string }[]
    const byRemote = new Map(existing.map((c) => [c.remote_id, c.id]))
    const account = db.prepare('SELECT label FROM accounts WHERE id = ?').get(accountId) as { label: string }
    const count = (db.prepare('SELECT COUNT(*) AS n FROM calendars').get() as { n: number }).n

    transaction(() => {
      remoteCalendars.forEach((rc, i) => {
        const id = byRemote.get(rc.remoteId)
        if (id) {
          db.prepare('UPDATE calendars SET name = ?, writable = ? WHERE id = ?').run(rc.name, rc.writable ? 1 : 0, id)
        } else {
          // New calendars arrive enabled with a distinct colour; people can rename/recolour/hide them in Settings.
          db.prepare('INSERT INTO calendars (id, account_id, remote_id, name, color, person, writable) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            newId(), accountId, rc.remoteId, rc.name, PALETTE[(count + i) % PALETTE.length] ?? rc.color, account.label.split('@')[0] ?? '', rc.writable ? 1 : 0,
          )
        }
      })
      const stillThere = new Set(remoteCalendars.map((c) => c.remoteId))
      for (const c of existing) if (!stillThere.has(c.remote_id)) db.prepare('DELETE FROM calendars WHERE id = ?').run(c.id)
    })

    if (provider.remote) {
      const { from, to } = syncWindow()
      const calendars = db.prepare('SELECT id, remote_id FROM calendars WHERE account_id = ? AND enabled = 1').all(accountId) as { id: string; remote_id: string }[]
      for (const cal of calendars) {
        const events = await provider.listEvents(cal.remote_id, from, to)
        transaction(() => {
          db.prepare('DELETE FROM events WHERE calendar_id = ?').run(cal.id)
          for (const e of events) insertEvent(cal.id, e)
        })
      }
    }
    db.prepare('UPDATE accounts SET last_error = NULL, last_synced_at = ? WHERE id = ?').run(new Date().toISOString(), accountId)
  } catch (err) {
    const message = (err as Error).message
    console.error(`Sync failed for account ${accountId}:`, message)
    db.prepare('UPDATE accounts SET last_error = ? WHERE id = ?').run(message, accountId)
    throw err
  }
}

let syncing: Promise<void> | null = null

export function syncAll() {
  syncing ??= (async () => {
    const accounts = db.prepare('SELECT id FROM accounts').all() as { id: string }[]
    for (const a of accounts) await syncAccount(a.id).catch(() => {})
  })().finally(() => (syncing = null))
  return syncing
}

export function startBackgroundSync() {
  syncAll()
  setInterval(syncAll, config.syncIntervalMs)
}

function insertEvent(calendarId: string, e: RemoteEvent) {
  const id = newId()
  db.prepare(
    'INSERT INTO events (id, calendar_id, remote_id, etag, title, start, end, all_day, location, notes, recurring, raw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, calendarId, e.remoteId, e.etag ?? null, e.title, e.start, e.end, e.allDay ? 1 : 0, e.location, e.notes, e.recurring ? 1 : 0, e.raw ?? null)
  return id
}

function toEvent(r: EventRow): CalendarEvent {
  return {
    id: r.id,
    calendarId: r.calendar_id,
    title: r.title,
    start: r.start,
    end: r.end,
    allDay: Boolean(r.all_day),
    location: r.location,
    notes: r.notes,
    recurring: Boolean(r.recurring),
  }
}

function toRemote(r: EventRow): RemoteEvent {
  return { remoteId: r.remote_id, etag: r.etag, title: r.title, start: r.start, end: r.end, allDay: Boolean(r.all_day), location: r.location, notes: r.notes, recurring: Boolean(r.recurring), raw: r.raw }
}

/**
 * Events overlapping [from, to). Timed events are stored as UTC ISO strings and all-day ones as YYYY-MM-DD,
 * so compare timed events on the instant and all-day events on the date.
 */
export function listEvents(from: string, to: string): CalendarEvent[] {
  const fromDate = from.slice(0, 10)
  const toDate = to.slice(0, 10)
  const rows = db
    .prepare(
      `SELECT e.* FROM events e JOIN calendars c ON c.id = e.calendar_id
       WHERE c.enabled = 1 AND (
         (e.all_day = 0 AND e.start < ? AND e.end > ?) OR
         (e.all_day = 1 AND e.start <= ? AND e.end > ?)
       )
       ORDER BY e.start`,
    )
    .all(to, from, toDate, fromDate) as unknown as EventRow[]
  return rows.map(toEvent)
}

function calendarFor(calendarId: string) {
  const cal = db.prepare('SELECT id, account_id, remote_id, writable FROM calendars WHERE id = ?').get(calendarId) as
    | { id: string; account_id: string; remote_id: string; writable: number }
    | undefined
  if (!cal) throw new ProviderError('Calendar not found', 404)
  if (!cal.writable) throw new ProviderError('That calendar is read-only', 403)
  return cal
}

function fieldsFrom(input: EventInput): EventFields {
  if (!input.title?.trim()) throw new ProviderError('Give the event a name', 400)
  if (!(input.end > input.start)) throw new ProviderError('The event must end after it starts', 400)
  return { title: input.title.trim(), start: input.start, end: input.end, allDay: input.allDay, location: input.location ?? '', notes: input.notes ?? '' }
}

function getRow(id: string) {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as EventRow | undefined
  if (!row) throw new ProviderError('Event not found', 404)
  return row
}

/** A write was rejected because the event changed elsewhere: refresh that account so the screen shows the latest. */
async function refreshOnConflict<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ProviderError && err.status === 409) await syncAccount(accountId).catch(() => {})
    throw err
  }
}

export async function createEvent(input: EventInput): Promise<CalendarEvent> {
  const cal = calendarFor(input.calendarId)
  const remote = await providerFor(cal.account_id).createEvent(cal.remote_id, fieldsFrom(input))
  const id = insertEvent(cal.id, remote)
  return toEvent(getRow(id))
}

export async function updateEvent(id: string, input: EventInput): Promise<CalendarEvent> {
  const row = getRow(id)
  if (input.calendarId !== row.calendar_id) {
    // Moving between calendars (e.g. from "Jack" to "Family"): create in the new one, then remove the old.
    const created = await createEvent(input)
    await deleteEvent(id)
    return created
  }
  const cal = calendarFor(row.calendar_id)
  const remote = await refreshOnConflict(cal.account_id, () => providerFor(cal.account_id).updateEvent(cal.remote_id, toRemote(row), fieldsFrom(input)))
  db.prepare('UPDATE events SET etag = ?, title = ?, start = ?, end = ?, all_day = ?, location = ?, notes = ?, raw = ? WHERE id = ?').run(
    remote.etag ?? null, remote.title, remote.start, remote.end, remote.allDay ? 1 : 0, remote.location, remote.notes, remote.raw ?? null, id,
  )
  // Other occurrences of an iCloud series share the same object and etag; re-pull so they stay consistent.
  if (row.recurring || remote.raw !== row.raw) syncAccount(cal.account_id).catch(() => {})
  return toEvent(getRow(id))
}

export async function deleteEvent(id: string) {
  const row = getRow(id)
  const cal = calendarFor(row.calendar_id)
  await refreshOnConflict(cal.account_id, () => providerFor(cal.account_id).deleteEvent(cal.remote_id, toRemote(row)))
  db.prepare('DELETE FROM events WHERE id = ?').run(id)
  if (row.recurring) syncAccount(cal.account_id).catch(() => {})
}
