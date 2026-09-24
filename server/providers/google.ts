import { config } from '../config.ts'
import { db } from '../db.ts'
import { ProviderError, type EventFields, type Provider, type RemoteCalendar, type RemoteEvent } from './types.ts'

// Talks to the Google Calendar REST API directly with fetch, so we don't need the (very large) googleapis package.

const API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar'

export interface GoogleCredentials {
  refreshToken: string
  accessToken?: string
  expiresAt?: number
}

/** The Google "OAuth client" comes from .env if set there, otherwise from what was pasted into the setup screen. */
function client() {
  if (config.google.clientId && config.google.clientSecret) return { clientId: config.google.clientId, clientSecret: config.google.clientSecret }
  const row = db.prepare("SELECT value FROM settings WHERE key = 'googleClient'").get() as { value: string } | undefined
  return row ? (JSON.parse(row.value) as { clientId: string; clientSecret: string }) : { clientId: '', clientSecret: '' }
}

export function googleConfigured() {
  const { clientId, clientSecret } = client()
  return Boolean(clientId && clientSecret)
}

export function saveGoogleClient(clientId: string, clientSecret: string) {
  clientId = clientId.trim()
  clientSecret = clientSecret.trim()
  if (!clientId.endsWith('.apps.googleusercontent.com')) throw new ProviderError('That doesn\'t look like a Client ID — it should end in .apps.googleusercontent.com', 400)
  if (clientSecret.length < 10) throw new ProviderError('That doesn\'t look like a Client secret', 400)
  db.prepare("INSERT INTO settings (key, value) VALUES ('googleClient', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify({ clientId, clientSecret }))
}

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: client().clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Always ask for consent so Google hands back a refresh token even if this account connected before.
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client().clientId, client_secret: client().clientSecret, ...body }),
  })
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new ProviderError(`Google sign-in failed: ${json.error_description ?? json.error ?? res.status}`, 400)
  }
  return json
}

export async function exchangeGoogleCode(code: string): Promise<{ credentials: GoogleCredentials; email: string }> {
  const tokens = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: config.google.redirectUri })
  if (!tokens.refresh_token) throw new ProviderError('Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and try again.', 400)
  const credentials = { refreshToken: tokens.refresh_token, accessToken: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000 }
  // The primary calendar's id is the account's email address; use it as the account label.
  const res = await fetch(`${API}/calendars/primary`, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  const primary = (await res.json()) as { id?: string }
  return { credentials, email: primary.id ?? 'Google' }
}

interface GoogleEvent {
  id: string
  etag?: string
  status?: string
  summary?: string
  location?: string
  description?: string
  recurringEventId?: string
  recurrence?: string[]
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
}

export class GoogleProvider implements Provider {
  readonly remote = true
  private credentials: GoogleCredentials
  private onCredentials: (c: GoogleCredentials) => void

  constructor(credentials: GoogleCredentials, onCredentials: (c: GoogleCredentials) => void) {
    this.credentials = credentials
    this.onCredentials = onCredentials
  }

  private async accessToken() {
    const { accessToken, expiresAt } = this.credentials
    if (accessToken && expiresAt && expiresAt - 60_000 > Date.now()) return accessToken
    const tokens = await tokenRequest({ refresh_token: this.credentials.refreshToken, grant_type: 'refresh_token' })
    this.credentials = { ...this.credentials, accessToken: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000 }
    this.onCredentials(this.credentials)
    return tokens.access_token!
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json', ...init.headers },
    })
    if (res.status === 204) return undefined as T
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
    if (!res.ok) throw new ProviderError(`Google Calendar: ${json.error?.message ?? res.statusText}`, res.status === 412 ? 409 : 502)
    return json
  }

  async listCalendars(): Promise<RemoteCalendar[]> {
    const data = await this.request<{ items: { id: string; summary: string; summaryOverride?: string; backgroundColor?: string; accessRole: string }[] }>(
      '/users/me/calendarList?maxResults=250',
    )
    return data.items.map((c) => ({
      remoteId: c.id,
      name: c.summaryOverride ?? c.summary,
      color: c.backgroundColor ?? '#4a7fb5',
      writable: c.accessRole === 'owner' || c.accessRole === 'writer',
    }))
  }

  async listEvents(calendarId: string, from: Date, to: Date): Promise<RemoteEvent[]> {
    const events: RemoteEvent[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', maxResults: '2500' })
      if (pageToken) params.set('pageToken', pageToken)
      const data = await this.request<{ items: GoogleEvent[]; nextPageToken?: string }>(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`)
      for (const e of data.items) if (e.status !== 'cancelled') events.push(fromGoogle(e))
      pageToken = data.nextPageToken
    } while (pageToken)
    return events
  }

  async createEvent(calendarId: string, fields: EventFields) {
    const e = await this.request<GoogleEvent>(`/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: JSON.stringify(toGoogle(fields)) })
    return fromGoogle(e)
  }

  async updateEvent(calendarId: string, existing: RemoteEvent, fields: EventFields) {
    // For a repeating event, remoteId is the id of this single occurrence, so only that occurrence changes.
    const e = await this.request<GoogleEvent>(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.remoteId)}`, {
      method: 'PATCH',
      body: JSON.stringify(toGoogle(fields)),
      headers: existing.etag ? { 'If-Match': existing.etag } : {},
    })
    return fromGoogle(e)
  }

  async deleteEvent(calendarId: string, existing: RemoteEvent) {
    await this.request(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.remoteId)}`, { method: 'DELETE' })
  }
}

function fromGoogle(e: GoogleEvent): RemoteEvent {
  const allDay = Boolean(e.start.date)
  return {
    remoteId: e.id,
    etag: e.etag ?? null,
    title: e.summary ?? '(No title)',
    start: allDay ? e.start.date! : new Date(e.start.dateTime!).toISOString(),
    end: allDay ? e.end.date! : new Date(e.end.dateTime!).toISOString(),
    allDay,
    location: e.location ?? '',
    notes: e.description ?? '',
    recurring: Boolean(e.recurringEventId || e.recurrence),
  }
}

function toGoogle(f: EventFields) {
  const when = (value: string) => (f.allDay ? { date: value, dateTime: null } : { dateTime: value, timeZone: config.timeZone, date: null })
  return { summary: f.title, location: f.location, description: f.notes, start: when(f.start), end: when(f.end) }
}
