import type { Calendar, CalendarEvent } from '../../../shared/types.ts'
import { addDays, eventsOnDay, sameDay } from '../dates.ts'

interface Props {
  month: Date
  events: CalendarEvent[]
  calendars: Calendar[]
  onDay: (day: Date) => void
}

const MAX_PER_CELL = 3

export function MonthView({ month, events, calendars, onDay }: Props) {
  const today = new Date()
  const byId = new Map(calendars.map((c) => [c.id, c]))
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  // Weeks start on Monday.
  const gridStart = addDays(first, -((first.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <div className="month">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <div key={d} className="month-dow">
          {d}
        </div>
      ))}
      {cells.map((day) => {
        const dayEvents = eventsOnDay(events, day)
        const outside = day.getMonth() !== month.getMonth()
        return (
          <button key={day.toDateString()} className={`month-cell ${outside ? 'outside' : ''} ${sameDay(day, today) ? 'is-today' : ''}`} onClick={() => onDay(day)}>
            <span className="month-num">{day.getDate()}</span>
            {dayEvents.slice(0, MAX_PER_CELL).map((e) => (
              <span key={e.id} className="month-pill" style={{ '--cal': byId.get(e.calendarId)?.color ?? '#888' } as React.CSSProperties}>
                {e.title}
              </span>
            ))}
            {dayEvents.length > MAX_PER_CELL && <span className="month-more">+{dayEvents.length - MAX_PER_CELL} more</span>}
          </button>
        )
      })}
    </div>
  )
}
