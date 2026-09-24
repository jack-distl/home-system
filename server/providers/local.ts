import { randomUUID } from 'node:crypto'
import type { EventFields, Provider, RemoteEvent } from './types.ts'

/** The built-in "Home" calendar. Events are stored only in the planner's own database. */
export class LocalProvider implements Provider {
  readonly remote = false

  async listCalendars() {
    return [{ remoteId: 'home', name: 'Home', color: '#7c8b6f', writable: true }]
  }

  async listEvents(): Promise<RemoteEvent[]> {
    return []
  }

  async createEvent(_calendar: string, fields: EventFields): Promise<RemoteEvent> {
    return { remoteId: randomUUID(), recurring: false, ...fields }
  }

  async updateEvent(_calendar: string, existing: RemoteEvent, fields: EventFields): Promise<RemoteEvent> {
    return { ...existing, ...fields }
  }

  async deleteEvent() {}
}
