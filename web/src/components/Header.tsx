import { api } from '../api.ts'
import { usePolled, useNow } from '../hooks.ts'
import { fmtTime } from '../dates.ts'

interface Props {
  view: 'week' | 'month'
  onView: (v: 'week' | 'month') => void
  anchor: Date
  onShift: (dir: number) => void
  onToday: () => void
  onAdd: () => void
  onSettings: () => void
  onSync: () => void
}

// WMO weather codes → a simple symbol.
function weatherIcon(code: number) {
  if (code === 0) return '☀︎'
  if (code <= 2) return '⛅︎'
  if (code === 3 || code === 45 || code === 48) return '☁︎'
  if (code >= 95) return '⛈︎'
  if (code >= 51) return '☂︎'
  return '☁︎'
}

export function Header({ view, onView, anchor, onShift, onToday, onAdd, onSettings, onSync }: Props) {
  const now = useNow()
  const weather = usePolled(api.weather, 20 * 60_000)
  const w = weather.data
  const title = anchor.toLocaleDateString('en-AU', view === 'week' ? { day: 'numeric', month: 'long' } : { month: 'long', year: 'numeric' })

  return (
    <header className="header">
      <div className="header-clock">
        <div className="clock">{fmtTime(now)}</div>
        <div className="today">{now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>
      {w && (
        <div className="weather">
          <span className="weather-icon">{weatherIcon(w.code)}</span>
          <span className="weather-temp">{Math.round(w.temperature)}°</span>
          <span className="weather-range">
            {Math.round(w.high)}° / {Math.round(w.low)}°
          </span>
        </div>
      )}
      <div className="header-nav">
        <div className="segmented">
          <button className={view === 'week' ? 'active' : ''} onClick={() => onView('week')}>
            Week
          </button>
          <button className={view === 'month' ? 'active' : ''} onClick={() => onView('month')}>
            Month
          </button>
        </div>
        <button className="icon-btn" onClick={() => onShift(-1)} aria-label="Previous">
          ‹
        </button>
        <button className="nav-title" onClick={onToday}>
          {title}
        </button>
        <button className="icon-btn" onClick={() => onShift(1)} aria-label="Next">
          ›
        </button>
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={onSync} aria-label="Refresh calendars">
          ⟳
        </button>
        <button className="icon-btn" onClick={onSettings} aria-label="Settings">
          ⚙︎
        </button>
        <button className="primary-btn" onClick={onAdd}>
          + Event
        </button>
      </div>
    </header>
  )
}
