import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expand } from './caldav.ts'

process.env.TZ = 'Australia/Perth'

const weekly = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VTIMEZONE
TZID:Australia/Perth
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:swim-1
DTSTAMP:20260901T000000Z
DTSTART;TZID=Australia/Perth:20260907T170000
DTEND;TZID=Australia/Perth:20260907T180000
RRULE:FREQ=WEEKLY;COUNT=6
EXDATE;TZID=Australia/Perth:20260921T170000
SUMMARY:Swimming
END:VEVENT
BEGIN:VEVENT
UID:swim-1
DTSTAMP:20260901T000000Z
RECURRENCE-ID;TZID=Australia/Perth:20260914T170000
DTSTART;TZID=Australia/Perth:20260914T173000
DTEND;TZID=Australia/Perth:20260914T183000
SUMMARY:Swimming (late)
END:VEVENT
END:VCALENDAR`

test('expands a weekly series with an exception and an excluded date', () => {
  const events = expand('/cal/swim.ics', '"1"', weekly, new Date('2026-09-01T00:00:00Z'), new Date('2026-10-31T00:00:00Z'))
  assert.equal(events.length, 5) // 6 occurrences minus the EXDATE
  assert.deepEqual(
    events.map((e) => [e.title, e.start]),
    [
      ['Swimming', '2026-09-07T09:00:00.000Z'],
      ['Swimming (late)', '2026-09-14T09:30:00.000Z'],
      ['Swimming', '2026-09-28T09:00:00.000Z'],
      ['Swimming', '2026-10-05T09:00:00.000Z'],
      ['Swimming', '2026-10-12T09:00:00.000Z'],
    ],
  )
  assert.ok(events.every((e) => e.recurring && !e.allDay))
})

test('only returns occurrences inside the window', () => {
  const events = expand('/cal/swim.ics', null, weekly, new Date('2026-10-01T00:00:00Z'), new Date('2026-10-08T00:00:00Z'))
  assert.deepEqual(events.map((e) => e.start), ['2026-10-05T09:00:00.000Z'])
})

test('reads a one-off all-day event as dates', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:bday
DTSTAMP:20260901T000000Z
DTSTART;VALUE=DATE:20261003
DTEND;VALUE=DATE:20261004
SUMMARY:Mum's birthday
END:VEVENT
END:VCALENDAR`
  const [e] = expand('/cal/bday.ics', null, ics, new Date('2026-09-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'))
  assert.equal(e?.allDay, true)
  assert.equal(e?.start, '2026-10-03')
  assert.equal(e?.end, '2026-10-04')
  assert.equal(e?.recurring, false)
})

test('editing one occurrence writes an exception; deleting one adds an EXDATE', async () => {
  const { CalDavProvider } = await import('./caldav.ts')
  const provider = new CalDavProvider({ serverUrl: 'https://example.test', username: 'u', password: 'p' })
  const written: string[] = []
  // Stand in for the network client.
  ;(provider as unknown as { client: unknown }).client = Promise.resolve({
    updateCalendarObject: async ({ calendarObject }: { calendarObject: { data: string } }) => {
      written.push(calendarObject.data)
      return { ok: true, status: 204 }
    },
  })
  const events = expand('/cal/swim.ics', '"1"', weekly, new Date('2026-09-01T00:00:00Z'), new Date('2026-10-31T00:00:00Z'))
  const oct5 = events.find((e) => e.start === '2026-10-05T09:00:00.000Z')!

  await provider.updateEvent('/cal/', oct5, { title: 'Swimming (pool closed early)', start: '2026-10-05T08:00:00.000Z', end: '2026-10-05T09:00:00.000Z', allDay: false, location: '', notes: '' })
  const afterEdit = expand('/cal/swim.ics', null, written[0]!, new Date('2026-09-01T00:00:00Z'), new Date('2026-10-31T00:00:00Z'))
  assert.equal(afterEdit.length, 5)
  assert.deepEqual(afterEdit.find((e) => e.title.includes('closed early'))?.start, '2026-10-05T08:00:00.000Z')

  await provider.deleteEvent('/cal/', { ...oct5 })
  const afterDelete = expand('/cal/swim.ics', null, written[1]!, new Date('2026-09-01T00:00:00Z'), new Date('2026-10-31T00:00:00Z'))
  assert.equal(afterDelete.length, 4)
  assert.ok(!afterDelete.some((e) => e.start.startsWith('2026-10-05')))
})
