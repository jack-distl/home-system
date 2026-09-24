import type { CalendarEvent } from '../../shared/types.ts'

// All dates are handled in the browser's local time, which on the wall screen is Perth time.

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes())
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** YYYY-MM-DD in local time. */
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseDateKey = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
/** HH:MM in local time. */
export const timeKey = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export const fmtTime = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()

export function eventStart(e: CalendarEvent) {
  return e.allDay ? parseDateKey(e.start) : new Date(e.start)
}
export function eventEnd(e: CalendarEvent) {
  return e.allDay ? parseDateKey(e.end) : new Date(e.end)
}

/** Does the event touch this calendar day? */
export function onDay(e: CalendarEvent, day: Date) {
  const s = startOfDay(day)
  const next = addDays(s, 1)
  return eventStart(e) < next && eventEnd(e) > s
}

export function eventsOnDay(events: CalendarEvent[], day: Date) {
  return events.filter((e) => onDay(e, day)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || eventStart(a).getTime() - eventStart(b).getTime())
}

export function describeTime(e: CalendarEvent, day: Date) {
  if (e.allDay) return 'All day'
  const s = eventStart(e)
  const en = eventEnd(e)
  const startsToday = sameDay(s, day)
  const endsToday = sameDay(en, day) || (en.getTime() === addDays(startOfDay(day), 1).getTime())
  if (startsToday && endsToday) return `${fmtTime(s)} – ${fmtTime(en)}`
  if (startsToday) return `${fmtTime(s)} →`
  if (endsToday) return `→ ${fmtTime(en)}`
  return 'All day'
}
