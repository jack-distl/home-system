import { useState } from 'react'
import { api } from '../api.ts'
import type { Calendar, CalendarEvent, EventInput } from '../../../shared/types.ts'
import { addDays, dateKey, eventEnd, eventStart, parseDateKey, timeKey } from '../dates.ts'

export type EditorState = { event: CalendarEvent; day?: undefined } | { event?: undefined; day: Date }

interface Props {
  state: EditorState
  calendars: Calendar[]
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}

function initialForm(state: EditorState, calendars: Calendar[]) {
  const writable = calendars.filter((c) => c.writable && c.enabled)
  if (state.event) {
    const e = state.event
    const s = eventStart(e)
    // All-day ends are exclusive; show the last day instead.
    const en = e.allDay ? addDays(eventEnd(e), -1) : eventEnd(e)
    return { calendarId: e.calendarId, title: e.title, allDay: e.allDay, date: dateKey(s), endDate: dateKey(en), startTime: timeKey(s), endTime: timeKey(eventEnd(e)), location: e.location, notes: e.notes }
  }
  // New event: next whole hour on the chosen day.
  const now = new Date()
  const hour = Math.min(Math.max(now.getHours() + 1, 7), 22)
  return {
    calendarId: writable[0]?.id ?? '',
    title: '',
    allDay: false,
    date: dateKey(state.day),
    endDate: dateKey(state.day),
    startTime: `${String(hour).padStart(2, '0')}:00`,
    endTime: `${String(hour + 1).padStart(2, '0')}:00`,
    location: '',
    notes: '',
  }
}

export function EventEditor({ state, calendars, onClose, onSaved, onError }: Props) {
  const [form, setForm] = useState(() => initialForm(state, calendars))
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const existing = state.event
  const calendar = calendars.find((c) => c.id === (existing?.calendarId ?? form.calendarId))
  const readOnly = Boolean(existing && calendar && !calendar.writable)
  const choices = calendars.filter((c) => c.enabled && (c.writable || c.id === existing?.calendarId))

  const toInput = (): EventInput => {
    let start: string
    let end: string
    if (form.allDay) {
      start = form.date
      end = dateKey(addDays(parseDateKey(form.endDate < form.date ? form.date : form.endDate), 1))
    } else {
      const s = new Date(`${form.date}T${form.startTime}`)
      let e = new Date(`${form.date}T${form.endTime}`)
      if (e <= s) e = new Date(s.getTime() + 60 * 60 * 1000)
      start = s.toISOString()
      end = e.toISOString()
    }
    return { calendarId: form.calendarId, title: form.title, allDay: form.allDay, start, end, location: form.location, notes: form.notes }
  }

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      onSaved()
    } catch (err) {
      onError((err as Error).message)
      setBusy(false)
    }
  }

  const save = () => act(() => (existing ? api.updateEvent(existing.id, toInput()) : api.createEvent(toInput())))
  const remove = () => {
    if (!existing) return
    const what = existing.recurring ? 'this occurrence of a repeating event' : `"${existing.title}"`
    if (confirm(`Delete ${what}?`)) act(() => api.deleteEvent(existing.id))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{existing ? (readOnly ? existing.title : 'Edit event') : 'New event'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <fieldset disabled={readOnly || busy} className="form">
          <input className="title-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What's happening?" autoFocus={!existing} />

          <div className="field">
            <label>Calendar</label>
            <div className="chips">
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${form.calendarId === c.id ? 'active' : ''}`}
                  style={{ '--cal': c.color } as React.CSSProperties}
                  onClick={() => set('calendarId', c.id)}
                >
                  {c.person ? `${c.person} · ${c.name}` : c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field row">
            <label className="toggle">
              <input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />
              <span>All day</span>
            </label>
          </div>

          <div className="field row">
            <label>{form.allDay ? 'From' : 'Date'}</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            {form.allDay ? (
              <>
                <label>To</label>
                <input type="date" value={form.endDate} min={form.date} onChange={(e) => set('endDate', e.target.value)} />
              </>
            ) : (
              <>
                <input type="time" step={300} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
                <span>to</span>
                <input type="time" step={300} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
              </>
            )}
          </div>

          <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Location" />
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes" rows={3} />
        </fieldset>

        {existing?.recurring && !readOnly && <p className="hint">This is part of a repeating event. Changes here apply to this day only.</p>}
        {readOnly && <p className="hint">This calendar is read-only. Change it from the phone it belongs to.</p>}

        <div className="modal-actions">
          {existing && !readOnly && (
            <button className="danger-btn" onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button className="secondary-btn" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button className="primary-btn" onClick={save} disabled={busy || !form.title.trim() || !form.calendarId}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
