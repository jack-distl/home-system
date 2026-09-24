import fs from 'node:fs'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { config } from './config.ts'
import { db, getSettings, newId, saveSettings, seed } from './db.ts'
import { artCacheDir, listArt, refreshArtCache } from './art.ts'
import { getWeather } from './weather.ts'
import { createEvent, deleteEvent, forgetProvider, listEvents, startBackgroundSync, syncAccount, syncAll, updateEvent } from './sync.ts'
import { exchangeGoogleCode, googleAuthUrl, googleConfigured, saveGoogleClient } from './providers/google.ts'
import { CalDavProvider, ICLOUD_SERVER } from './providers/caldav.ts'
import { ProviderError } from './providers/types.ts'
import type { Account, Calendar, EventInput, List, ListItem, Settings } from '../shared/types.ts'

process.env.TZ ||= config.timeZone
seed()

const app = Fastify({ logger: { level: 'warn' } })
/** Changes on every restart; the screen reloads itself when it sees a new value (i.e. after an update). */
const bootId = randomUUID()

app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
  const status = err instanceof ProviderError ? err.status : (err.statusCode ?? 500)
  if (status >= 500) console.error(err)
  reply.status(status).send({ error: err.message })
})

// ---------- Status ----------

/** Addresses a phone or laptop on the home Wi-Fi can use to reach this planner. */
function addresses() {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i!.address}:${config.port}`)
  return [`http://${os.hostname()}.local:${config.port}`, ...ips]
}

app.get('/api/status', async () => ({ bootId, googleConfigured: googleConfigured(), timeZone: config.timeZone, addresses: addresses() }))
app.get('/api/weather', async () => getWeather())

// ---------- Accounts & calendars ----------

app.get('/api/accounts', async (): Promise<Account[]> => {
  const rows = db.prepare('SELECT id, provider, label, last_error, last_synced_at FROM accounts ORDER BY rowid').all() as Record<string, string | null>[]
  return rows.map((r) => ({ id: r.id!, provider: r.provider as Account['provider'], label: r.label!, lastError: r.last_error ?? null, lastSyncedAt: r.last_synced_at ?? null }))
})

app.delete<{ Params: { id: string } }>('/api/accounts/:id', async (req) => {
  forgetProvider(req.params.id)
  db.prepare("DELETE FROM accounts WHERE id = ? AND provider != 'local'").run(req.params.id)
  return { ok: true }
})

app.post<{ Body: { label?: string; serverUrl?: string; username: string; password: string } }>('/api/accounts/caldav', async (req) => {
  const { username, password } = req.body
  const serverUrl = req.body.serverUrl?.trim() || ICLOUD_SERVER
  if (!username || !password) throw new ProviderError('Enter your Apple ID email and an app-specific password', 400)
  const credentials = { serverUrl, username: username.trim(), password: password.trim() }
  // Check the details work before saving them.
  await new CalDavProvider(credentials).listCalendars()
  const id = newId()
  db.prepare("INSERT INTO accounts (id, provider, label, credentials) VALUES (?, 'caldav', ?, ?)").run(id, req.body.label?.trim() || credentials.username, JSON.stringify(credentials))
  await syncAccount(id)
  return { id }
})

// Google sign-in. If the consent screen was opened on the touchscreen itself, Google redirects straight back
// to /callback. From a phone or laptop the redirect to "localhost" fails, so the person pastes that URL into
// Settings instead and it is posted to /code.
// Sign-in attempts in progress: state → whose calendar it is.
const pendingStates = new Map<string, string>()

app.put<{ Body: { clientId: string; clientSecret: string } }>('/api/google-client', async (req) => {
  saveGoogleClient(req.body.clientId ?? '', req.body.clientSecret ?? '')
  return { ok: true }
})

app.get<{ Querystring: { person?: string } }>('/api/oauth/google/start', async (req) => {
  if (!googleConfigured()) throw new ProviderError('Google is not set up yet — paste your Client ID and Client secret first', 400)
  const state = randomUUID()
  pendingStates.set(state, req.query.person?.trim() ?? '')
  return { url: googleAuthUrl(state) }
})

async function finishGoogle(code: string, state: string | null) {
  const person = state ? pendingStates.get(state) : undefined
  if (!state || person === undefined) throw new ProviderError('That sign-in link has expired. Tap "Get sign-in link" and try again.', 400)
  pendingStates.delete(state)
  const { credentials, email } = await exchangeGoogleCode(code)
  const existing = db.prepare("SELECT id FROM accounts WHERE provider = 'google' AND label = ?").get(email) as { id: string } | undefined
  const id = existing?.id ?? newId()
  if (existing) {
    db.prepare('UPDATE accounts SET credentials = ? WHERE id = ?').run(JSON.stringify(credentials), id)
    forgetProvider(id)
  } else {
    db.prepare("INSERT INTO accounts (id, provider, label, credentials) VALUES (?, 'google', ?, ?)").run(id, email, JSON.stringify(credentials))
  }
  await syncAccount(id)
  if (person) db.prepare('UPDATE calendars SET person = ? WHERE account_id = ?').run(person, id)
}

app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/api/oauth/google/callback', async (req, reply) => {
  const back = getSettings().setupDone ? '/?settings=1' : '/?'
  if (req.query.error || !req.query.code) return reply.redirect(`${back}&error=${encodeURIComponent(req.query.error ?? 'Google sign-in cancelled')}`)
  try {
    await finishGoogle(req.query.code, req.query.state ?? null)
    return reply.redirect(back)
  } catch (err) {
    return reply.redirect(`${back}&error=${encodeURIComponent((err as Error).message)}`)
  }
})

app.post<{ Body: { url: string } }>('/api/oauth/google/code', async (req) => {
  let params: URLSearchParams
  try {
    params = new URL(req.body.url.trim()).searchParams
  } catch {
    throw new ProviderError('Paste the whole address from the browser bar (it starts with http://localhost)', 400)
  }
  const code = params.get('code')
  if (!code) throw new ProviderError('That address has no sign-in code in it', 400)
  await finishGoogle(code, params.get('state'))
  return { ok: true }
})

app.get('/api/calendars', async (): Promise<Calendar[]> => {
  const rows = db.prepare('SELECT * FROM calendars ORDER BY rowid').all() as Record<string, string | number>[]
  return rows.map((r) => ({
    id: String(r.id), accountId: String(r.account_id), name: String(r.name), color: String(r.color), person: String(r.person), enabled: Boolean(r.enabled), writable: Boolean(r.writable),
  }))
})

app.patch<{ Params: { id: string }; Body: Partial<Pick<Calendar, 'name' | 'color' | 'person' | 'enabled'>> }>('/api/calendars/:id', async (req) => {
  const b = req.body
  const cal = db.prepare('SELECT account_id, enabled FROM calendars WHERE id = ?').get(req.params.id) as { account_id: string; enabled: number } | undefined
  if (!cal) throw new ProviderError('Calendar not found', 404)
  db.prepare('UPDATE calendars SET name = COALESCE(?, name), color = COALESCE(?, color), person = COALESCE(?, person), enabled = COALESCE(?, enabled) WHERE id = ?').run(
    b.name ?? null, b.color ?? null, b.person ?? null, b.enabled === undefined ? null : b.enabled ? 1 : 0, req.params.id,
  )
  if (b.enabled && !cal.enabled) await syncAccount(cal.account_id).catch(() => {})
  return { ok: true }
})

app.post('/api/sync', async () => {
  await syncAll()
  return { ok: true }
})

// ---------- Events ----------

app.get<{ Querystring: { from: string; to: string } }>('/api/events', async (req) => listEvents(req.query.from, req.query.to))
app.post<{ Body: EventInput }>('/api/events', async (req) => createEvent(req.body))
app.put<{ Params: { id: string }; Body: EventInput }>('/api/events/:id', async (req) => updateEvent(req.params.id, req.body))
app.delete<{ Params: { id: string } }>('/api/events/:id', async (req) => {
  await deleteEvent(req.params.id)
  return { ok: true }
})

// ---------- Lists ----------

const toItem = (r: Record<string, unknown>): ListItem => ({
  id: String(r.id), listId: String(r.list_id), text: String(r.text), done: Boolean(r.done), sort: Number(r.sort), createdAt: String(r.created_at), doneAt: (r.done_at as string) ?? null,
})

app.get('/api/lists', async () => {
  const lists = db.prepare('SELECT * FROM lists ORDER BY sort, rowid').all() as unknown as List[]
  // Ticked items stay visible for a day so a mis-tap can be undone, then drop off.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const items = (db.prepare('SELECT * FROM list_items WHERE done = 0 OR done_at > ? ORDER BY done, sort, created_at').all(cutoff) as Record<string, unknown>[]).map(toItem)
  return lists.map((l) => ({ ...l, items: items.filter((i) => i.listId === l.id) }))
})

app.post<{ Body: { name: string; icon?: string } }>('/api/lists', async (req) => {
  if (!req.body.name?.trim()) throw new ProviderError('Give the list a name', 400)
  const sort = (db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM lists').get() as { s: number }).s
  const id = newId()
  db.prepare('INSERT INTO lists (id, name, icon, sort) VALUES (?, ?, ?, ?)').run(id, req.body.name.trim(), req.body.icon ?? '', sort)
  return { id }
})

app.patch<{ Params: { id: string }; Body: { name?: string; icon?: string } }>('/api/lists/:id', async (req) => {
  db.prepare('UPDATE lists SET name = COALESCE(?, name), icon = COALESCE(?, icon) WHERE id = ?').run(req.body.name ?? null, req.body.icon ?? null, req.params.id)
  return { ok: true }
})

app.delete<{ Params: { id: string } }>('/api/lists/:id', async (req) => {
  db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id)
  return { ok: true }
})

app.post<{ Params: { id: string }; Body: { text: string } }>('/api/lists/:id/items', async (req) => {
  const text = req.body.text?.trim()
  if (!text) throw new ProviderError('Type something to add', 400)
  const id = newId()
  db.prepare('INSERT INTO list_items (id, list_id, text, created_at) VALUES (?, ?, ?, ?)').run(id, req.params.id, text, new Date().toISOString())
  return toItem(db.prepare('SELECT * FROM list_items WHERE id = ?').get(id) as Record<string, unknown>)
})

app.patch<{ Params: { id: string }; Body: { text?: string; done?: boolean } }>('/api/items/:id', async (req) => {
  const { text, done } = req.body
  db.prepare('UPDATE list_items SET text = COALESCE(?, text), done = COALESCE(?, done), done_at = CASE WHEN ? IS NULL THEN done_at WHEN ? = 1 THEN ? ELSE NULL END WHERE id = ?').run(
    text ?? null, done === undefined ? null : done ? 1 : 0, done === undefined ? null : 1, done ? 1 : 0, new Date().toISOString(), req.params.id,
  )
  return { ok: true }
})

app.delete<{ Params: { id: string } }>('/api/items/:id', async (req) => {
  db.prepare('DELETE FROM list_items WHERE id = ?').run(req.params.id)
  return { ok: true }
})

app.post<{ Params: { id: string } }>('/api/lists/:id/clear-done', async (req) => {
  db.prepare('DELETE FROM list_items WHERE list_id = ? AND done = 1').run(req.params.id)
  return { ok: true }
})

// ---------- Settings & art ----------

app.get('/api/settings', async () => getSettings())
app.put<{ Body: Partial<Settings> }>('/api/settings', async (req) => {
  const before = getSettings()
  const after = saveSettings(req.body)
  if (after.artQuery !== before.artQuery || after.artSource !== before.artSource) refreshArtCache(true)
  return after
})

/** Used by deploy/display-schedule.sh (run every minute) to switch the panel off overnight. */
app.get('/api/display', async () => {
  const { nightStart, nightEnd } = getSettings()
  if (!nightStart || !nightEnd) return { on: true }
  const now = new Date().toTimeString().slice(0, 5)
  const night = nightStart < nightEnd ? now >= nightStart && now < nightEnd : now >= nightStart || now < nightEnd
  return { on: !night }
})

app.get('/api/art', async () => listArt())
app.post('/api/art/refresh', async () => {
  await refreshArtCache(true)
  return listArt()
})

// ---------- Static files ----------

fs.mkdirSync(config.artDir, { recursive: true })
await app.register(fastifyStatic, { root: config.artDir, prefix: '/art-files/local/', decorateReply: false })
await app.register(fastifyStatic, { root: artCacheDir, prefix: '/art-files/cache/', decorateReply: false })
if (fs.existsSync(config.webDir)) {
  await app.register(fastifyStatic, { root: config.webDir, prefix: '/' })
  app.setNotFoundHandler((req, reply) => (req.url.startsWith('/api/') ? reply.status(404).send({ error: 'Not found' }) : reply.sendFile('index.html')))
} else {
  app.get('/', async () => 'UI not built yet. Run "npm run build" (or "npm run dev" and open port 5173).')
}

await app.listen({ port: config.port, host: '0.0.0.0' })
console.log(`Home planner running on http://localhost:${config.port}`)

startBackgroundSync()
refreshArtCache()
setInterval(() => refreshArtCache(), 24 * 60 * 60 * 1000)
