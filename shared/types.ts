// Types shared between the server and the touchscreen UI.

export type ProviderKind = 'local' | 'google' | 'caldav'

export interface Account {
  id: string
  provider: ProviderKind
  label: string
  /** Last sync error, if the most recent sync failed. */
  lastError: string | null
  lastSyncedAt: string | null
}

export interface Calendar {
  id: string
  accountId: string
  name: string
  color: string
  /** Whose calendar this is, e.g. "Jack", "Family". Shown as a chip on events. */
  person: string
  enabled: boolean
  writable: boolean
}

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  /** ISO timestamp for timed events, YYYY-MM-DD for all-day events. */
  start: string
  /** Exclusive end. ISO timestamp, or YYYY-MM-DD (the day after the last day) for all-day. */
  end: string
  allDay: boolean
  location: string
  notes: string
  /** Part of a repeating series. Editing changes this occurrence only where the provider supports it. */
  recurring: boolean
}

export interface EventInput {
  calendarId: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
  notes?: string
}

export interface List {
  id: string
  name: string
  icon: string
  sort: number
}

export interface ListItem {
  id: string
  listId: string
  text: string
  done: boolean
  sort: number
  createdAt: string
  doneAt: string | null
}

export interface Settings {
  /** Seconds of no touches before falling back to art mode. */
  idleSeconds: number
  /** Seconds each artwork is shown. */
  artSeconds: number
  /** Show a small clock over the art. */
  artClock: boolean
  /** 'local' = only images in the art/ folder, 'aic' = also public-domain works from the Art Institute of Chicago. */
  artSource: 'local' | 'aic'
  /** Search term used to pick public-domain works, e.g. "landscape", "impressionism". */
  artQuery: string
  /** 24h "HH:MM" window when the screen should be dark (handled by deploy/display-schedule.sh). Empty = never. */
  nightStart: string
  nightEnd: string
}

export interface Artwork {
  url: string
  title: string
  artist: string
}

export interface Weather {
  temperature: number
  high: number
  low: number
  code: number
}
