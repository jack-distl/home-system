import type { Account, Artwork, Calendar, CalendarEvent, EventInput, List, ListItem, Settings, Weather } from '../../shared/types.ts'

export type ListWithItems = List & { items: ListItem[] }

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`)
  return json as T
}

export const api = {
  status: () => request<{ bootId: string; googleConfigured: boolean; timeZone: string }>('GET', '/api/status'),
  weather: () => request<Weather | null>('GET', '/api/weather'),

  accounts: () => request<Account[]>('GET', '/api/accounts'),
  removeAccount: (id: string) => request('DELETE', `/api/accounts/${id}`),
  addCalDav: (body: { label?: string; serverUrl?: string; username: string; password: string }) => request('POST', '/api/accounts/caldav', body),
  googleStart: () => request<{ url: string }>('GET', '/api/oauth/google/start'),
  googleCode: (url: string) => request('POST', '/api/oauth/google/code', { url }),
  sync: () => request('POST', '/api/sync'),

  calendars: () => request<Calendar[]>('GET', '/api/calendars'),
  updateCalendar: (id: string, patch: Partial<Calendar>) => request('PATCH', `/api/calendars/${id}`, patch),

  events: (from: Date, to: Date) => request<CalendarEvent[]>('GET', `/api/events?from=${from.toISOString()}&to=${to.toISOString()}`),
  createEvent: (e: EventInput) => request<CalendarEvent>('POST', '/api/events', e),
  updateEvent: (id: string, e: EventInput) => request<CalendarEvent>('PUT', `/api/events/${id}`, e),
  deleteEvent: (id: string) => request('DELETE', `/api/events/${id}`),

  lists: () => request<ListWithItems[]>('GET', '/api/lists'),
  addList: (name: string, icon = '') => request('POST', '/api/lists', { name, icon }),
  updateList: (id: string, patch: { name?: string; icon?: string }) => request('PATCH', `/api/lists/${id}`, patch),
  deleteList: (id: string) => request('DELETE', `/api/lists/${id}`),
  addItem: (listId: string, text: string) => request<ListItem>('POST', `/api/lists/${listId}/items`, { text }),
  updateItem: (id: string, patch: { text?: string; done?: boolean }) => request('PATCH', `/api/items/${id}`, patch),
  deleteItem: (id: string) => request('DELETE', `/api/items/${id}`),
  clearDone: (listId: string) => request('POST', `/api/lists/${listId}/clear-done`),

  settings: () => request<Settings>('GET', '/api/settings'),
  saveSettings: (patch: Partial<Settings>) => request<Settings>('PUT', '/api/settings', patch),
  art: () => request<Artwork[]>('GET', '/api/art'),
  refreshArt: () => request<Artwork[]>('POST', '/api/art/refresh'),
}
