import { randomUUID } from 'node:crypto'
import ICAL from 'ical.js'
import { createDAVClient, type DAVCalendar } from 'tsdav'
import { ProviderError, type EventFields, type Provider, type RemoteCalendar, type RemoteEvent } from './types.ts'

// CalDAV covers iCloud (the default calendar app on iPhone), Fastmail, Nextcloud and most other non-Google calendars.

export interface CalDavCredentials {
  serverUrl: string
  username: string
  password: string
}

export const ICLOUD_SERVER = 'https://caldav.icloud.com'

/** What we keep per event so it can be written back: the whole iCalendar object, and which occurrence this is. */
interface CalDavRaw {
  url: string
  ics: string
  /** Original start of this occurrence (ICAL.Time string), for repeating events only. */
  rid?: string
}

type DAVClient = Awaited<ReturnType<typeof createDAVClient>>

export class CalDavProvider implements Provider {
  readonly remote = true
  private credentials: CalDavCredentials
  private client: Promise<DAVClient> | null = null
  private calendars = new Map<string, DAVCalendar>()

  constructor(credentials: CalDavCredentials) {
    this.credentials = credentials
  }

  private getClient() {
    this.client ??= createDAVClient({
      serverUrl: this.credentials.serverUrl,
      credentials: { username: this.credentials.username, password: this.credentials.password },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    }).catch((err) => {
      this.client = null
      throw new ProviderError(`Could not sign in to ${this.credentials.serverUrl}: ${err.message}`, 400)
    })
    return this.client
  }

  private async calendar(url: string) {
    if (!this.calendars.has(url)) await this.listCalendars()
    const cal = this.calendars.get(url)
    if (!cal) throw new ProviderError('Calendar no longer exists on the server')
    return cal
  }

  async listCalendars(): Promise<RemoteCalendar[]> {
    const client = await this.getClient()
    const calendars = await client.fetchCalendars()
    this.calendars.clear()
    return calendars
      .filter((c) => !c.components || c.components.includes('VEVENT'))
      .map((c) => {
        this.calendars.set(c.url, c)
        return {
          remoteId: c.url,
          name: typeof c.displayName === 'string' ? c.displayName : 'Calendar',
          // iCloud returns #RRGGBBAA.
          color: (c.calendarColor ?? '#b5654a').slice(0, 7),
          writable: true,
        }
      })
  }

  async listEvents(calendarUrl: string, from: Date, to: Date): Promise<RemoteEvent[]> {
    const client = await this.getClient()
    const objects = await client.fetchCalendarObjects({
      calendar: await this.calendar(calendarUrl),
      timeRange: { start: from.toISOString(), end: to.toISOString() },
    })
    const events: RemoteEvent[] = []
    for (const obj of objects) {
      if (!obj.data) continue
      try {
        events.push(...expand(obj.url, obj.etag ?? null, obj.data, from, to))
      } catch (err) {
        console.warn(`Skipping unreadable event ${obj.url}:`, (err as Error).message)
      }
    }
    return events
  }

  async createEvent(calendarUrl: string, fields: EventFields): Promise<RemoteEvent> {
    const client = await this.getClient()
    const calendar = await this.calendar(calendarUrl)
    const uid = randomUUID()
    const vcal = new ICAL.Component('vcalendar')
    vcal.addPropertyWithValue('version', '2.0')
    vcal.addPropertyWithValue('prodid', '-//home-planner//EN')
    const vevent = new ICAL.Component('vevent')
    vevent.addPropertyWithValue('uid', uid)
    vevent.addPropertyWithValue('dtstamp', ICAL.Time.now())
    applyFields(vevent, fields)
    vcal.addSubcomponent(vevent)
    const ics = vcal.toString()
    const filename = `${uid}.ics`
    const res = await client.createCalendarObject({ calendar, filename, iCalString: ics })
    if (!res.ok) throw new ProviderError(`Calendar server refused the new event (${res.status})`)
    const url = new URL(filename, calendar.url.endsWith('/') ? calendar.url : `${calendar.url}/`).href
    return { remoteId: url, etag: res.headers.get('etag'), recurring: false, raw: JSON.stringify({ url, ics } satisfies CalDavRaw), ...fields }
  }

  async updateEvent(_calendarUrl: string, existing: RemoteEvent, fields: EventFields): Promise<RemoteEvent> {
    const raw = JSON.parse(existing.raw!) as CalDavRaw
    const vcal = parseWithTimezones(raw.ics)
    const master = masterEvent(vcal)
    if (raw.rid) {
      // One occurrence of a repeating event: write (or rewrite) an exception for just that occurrence.
      const rid = occurrenceTime(master, raw.rid)
      let exception = findException(vcal, rid)
      if (!exception) {
        exception = new ICAL.Component('vevent')
        exception.addPropertyWithValue('uid', master.getFirstPropertyValue('uid') as string)
        exception.addProperty(timeProperty('recurrence-id', rid))
        vcal.addSubcomponent(exception)
      }
      exception.updatePropertyWithValue('dtstamp', ICAL.Time.now())
      applyFields(exception, fields)
    } else {
      applyFields(master, fields)
    }
    const ics = vcal.toString()
    await this.write(raw.url, ics, existing.etag)
    return { ...existing, ...fields, raw: JSON.stringify({ ...raw, ics }) }
  }

  async deleteEvent(_calendarUrl: string, existing: RemoteEvent) {
    const raw = JSON.parse(existing.raw!) as CalDavRaw
    const client = await this.getClient()
    if (!raw.rid) {
      const res = await client.deleteCalendarObject({ calendarObject: { url: raw.url, etag: existing.etag ?? undefined } })
      if (!res.ok && res.status !== 404) throw conflictOr(res.status, 'delete')
      return
    }
    // One occurrence of a repeating event: exclude it from the series.
    const vcal = parseWithTimezones(raw.ics)
    const master = masterEvent(vcal)
    const rid = occurrenceTime(master, raw.rid)
    const exception = findException(vcal, rid)
    if (exception) vcal.removeSubcomponent(exception)
    master.addProperty(timeProperty('exdate', rid))
    await this.write(raw.url, vcal.toString(), existing.etag)
  }

  private async write(url: string, ics: string, etag?: string | null) {
    const client = await this.getClient()
    const res = await client.updateCalendarObject({ calendarObject: { url, data: ics, etag: etag ?? undefined } })
    if (!res.ok) throw conflictOr(res.status, 'save')
  }
}

function conflictOr(status: number, action: string) {
  if (status === 412) return new ProviderError('This event was changed on another device. It has been refreshed; please try again.', 409)
  return new ProviderError(`Calendar server refused to ${action} the event (${status})`)
}

function parseWithTimezones(ics: string) {
  const vcal = new ICAL.Component(ICAL.parse(ics))
  // Register the object's own timezone definitions before any date is read, so TZID times resolve correctly.
  for (const tz of vcal.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz)
  return vcal
}

function masterEvent(vcal: ICAL.Component) {
  const vevents = vcal.getAllSubcomponents('vevent')
  const master = vevents.find((v) => !v.hasProperty('recurrence-id')) ?? vevents[0]
  if (!master) throw new Error('no VEVENT')
  return master
}

function findException(vcal: ICAL.Component, rid: ICAL.Time) {
  return vcal
    .getAllSubcomponents('vevent')
    .find((v) => v.hasProperty('recurrence-id') && (v.getFirstPropertyValue('recurrence-id') as ICAL.Time).compare(rid) === 0)
}

/** Rebuild an occurrence's original start in the same timezone as the series' DTSTART. */
function occurrenceTime(master: ICAL.Component, rid: string) {
  const start = master.getFirstPropertyValue('dtstart') as ICAL.Time
  const time = ICAL.Time.fromString(rid, null)
  if (!time.isDate && !rid.endsWith('Z') && start.zone) time.zone = start.zone
  return time
}

function timeProperty(name: string, time: ICAL.Time) {
  const prop = new ICAL.Property(name)
  prop.setValue(time)
  const tzid = time.zone?.tzid
  if (!time.isDate && tzid && tzid !== 'UTC' && tzid !== 'floating') prop.setParameter('tzid', tzid)
  return prop
}

function applyFields(vevent: ICAL.Component, f: EventFields) {
  vevent.updatePropertyWithValue('summary', f.title)
  for (const [name, value] of [['location', f.location], ['description', f.notes]] as const) {
    if (value) vevent.updatePropertyWithValue(name, value)
    else vevent.removeAllProperties(name)
  }
  vevent.removeAllProperties('duration')
  for (const [name, value] of [['dtstart', f.start], ['dtend', f.end]] as const) {
    vevent.removeAllProperties(name)
    // Timed events are written in UTC, which every calendar app understands; all-day events as plain dates.
    const time = f.allDay ? ICAL.Time.fromDateString(value) : ICAL.Time.fromJSDate(new Date(value), true)
    vevent.addProperty(timeProperty(name, time))
  }
}

function toIso(time: ICAL.Time, allDay: boolean) {
  return allDay ? time.toString().slice(0, 10) : time.toJSDate().toISOString()
}

/** Turn one CalDAV object into the concrete events that fall inside [from, to), expanding repeating series. */
export function expand(url: string, etag: string | null, ics: string, from: Date, to: Date): RemoteEvent[] {
  const vcal = parseWithTimezones(ics)
  const vevents = vcal.getAllSubcomponents('vevent')
  const master = vevents.find((v) => !v.hasProperty('recurrence-id'))
  const exceptions = vevents.filter((v) => v.hasProperty('recurrence-id'))
  const base = (e: ICAL.Event) => ({
    title: e.summary || '(No title)',
    location: e.location ?? '',
    notes: e.description ?? '',
    allDay: e.startDate.isDate,
    etag,
  })

  if (!master) {
    // Server sent only an overridden occurrence (possible with time-range queries). Show it as-is, read-only by series.
    return exceptions.map((v) => {
      const e = new ICAL.Event(v)
      const rid = (v.getFirstPropertyValue('recurrence-id') as ICAL.Time).toString()
      return { ...base(e), remoteId: `${url}#${rid}`, start: toIso(e.startDate, e.startDate.isDate), end: toIso(e.endDate, e.startDate.isDate), recurring: true, raw: JSON.stringify({ url, ics, rid } satisfies CalDavRaw) }
    })
  }

  const event = new ICAL.Event(master, { exceptions, strictExceptions: false })
  if (!event.isRecurring()) {
    return [{ ...base(event), remoteId: url, start: toIso(event.startDate, event.startDate.isDate), end: toIso(event.endDate, event.startDate.isDate), recurring: false, raw: JSON.stringify({ url, ics } satisfies CalDavRaw) }]
  }

  const results: RemoteEvent[] = []
  const iterator = event.iterator()
  for (let next = iterator.next(), guard = 0; next && guard < 5000; next = iterator.next(), guard++) {
    const details = event.getOccurrenceDetails(next)
    if (details.startDate.toJSDate() >= to) break
    if (details.endDate.toJSDate() <= from) continue
    const allDay = details.startDate.isDate
    const rid = next.toString()
    results.push({
      ...base(details.item),
      allDay,
      remoteId: `${url}#${rid}`,
      start: toIso(details.startDate, allDay),
      end: toIso(details.endDate, allDay),
      recurring: true,
      raw: JSON.stringify({ url, ics, rid } satisfies CalDavRaw),
    })
  }
  return results
}
