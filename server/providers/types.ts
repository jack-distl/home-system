export interface RemoteCalendar {
  remoteId: string
  name: string
  color: string
  writable: boolean
}

export interface RemoteEvent {
  remoteId: string
  etag?: string | null
  title: string
  start: string
  end: string
  allDay: boolean
  location: string
  notes: string
  recurring: boolean
  /** Provider-specific data needed to write the event back (e.g. the original iCalendar text). */
  raw?: string | null
}

export interface EventFields {
  title: string
  start: string
  end: string
  allDay: boolean
  location: string
  notes: string
}

export interface Provider {
  /** false for the built-in calendar, whose events live only in the local database. */
  readonly remote: boolean
  listCalendars(): Promise<RemoteCalendar[]>
  listEvents(calendarRemoteId: string, from: Date, to: Date): Promise<RemoteEvent[]>
  createEvent(calendarRemoteId: string, fields: EventFields): Promise<RemoteEvent>
  updateEvent(calendarRemoteId: string, existing: RemoteEvent, fields: EventFields): Promise<RemoteEvent>
  deleteEvent(calendarRemoteId: string, existing: RemoteEvent): Promise<void>
}

export class ProviderError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}
