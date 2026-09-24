import type { Calendar, CalendarEvent } from '../../../shared/types.ts'
import { addDays, describeTime, eventsOnDay, sameDay } from '../dates.ts'

interface Props {
  start: Date
  events: CalendarEvent[]
  calendars: Calendar[]
  onEvent: (e: CalendarEvent) => void
  onDay: (day: Date) => void
}

/** Seven day columns starting at `start`, each an agenda of that day's events. Tap empty space to add. */
export function WeekView({ start, events, calendars, onEvent, onDay }: Props) {
  const today = new Date()
  const byId = new Map(calendars.map((c) => [c.id, c]))
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  return (
    <div className="week">
      {days.map((day) => {
        const dayEvents = eventsOnDay(events, day)
        return (
          <div key={day.toDateString()} className={`day-col ${sameDay(day, today) ? 'is-today' : ''}`} onClick={() => onDay(day)}>
            <div className="day-head">
              <span className="day-name">{day.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
              <span className="day-num">{day.getDate()}</span>
            </div>
            <div className="day-events">
              {dayEvents.map((e) => {
                const cal = byId.get(e.calendarId)
                return (
                  <button
                    key={e.id}
                    className={`event-card ${e.allDay ? 'all-day' : ''}`}
                    style={{ '--cal': cal?.color ?? '#888' } as React.CSSProperties}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onEvent(e)
                    }}
                  >
                    <span className="event-time">{describeTime(e, day)}</span>
                    <span className="event-title">{e.title}</span>
                    {cal?.person && <span className="event-person">{cal.person}</span>}
                  </button>
                )
              })}
              {dayEvents.length === 0 && <div className="day-empty">Free</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
