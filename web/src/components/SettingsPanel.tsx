import { useState } from 'react'
import { api } from '../api.ts'
import { usePolled } from '../hooks.ts'
import { AccountList, CalendarList, GoogleConnect, ICloudConnect, useRunner } from './Connect.tsx'
import type { Calendar, Settings } from '../../../shared/types.ts'

interface Props {
  settings: Settings
  calendars: Calendar[]
  onSettings: (s: Settings) => void
  onChanged: () => void
  onClose: () => void
  onError: (msg: string) => void
}

export function SettingsPanel({ settings, calendars, onSettings, onChanged, onClose, onError }: Props) {
  const accounts = usePolled(api.accounts, 30_000)
  const status = usePolled(api.status, 60_000)
  const lists = usePolled(api.lists, 60_000)
  const [newList, setNewList] = useState('')
  const { busy, run } = useRunner(onError, () => {
    accounts.reload()
    status.reload()
    lists.reload()
    onChanged()
  })

  const save = async (patch: Partial<Settings>) => {
    try {
      onSettings(await api.saveSettings(patch))
    } catch (err) {
      onError((err as Error).message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="hint">
          Tip: it's easier to change these from a laptop or phone on the same Wi-Fi — open <strong>{status.data?.addresses[0] ?? `http://${location.host}`}</strong>.
        </p>

        <section>
          <h3>Connected calendars</h3>
          <AccountList accounts={accounts.data ?? []} run={run} busy={busy} />
          <details>
            <summary>Add an iPhone (iCloud) calendar</summary>
            <ICloudConnect run={run} busy={busy} />
          </details>
          <details>
            <summary>Add a Google calendar</summary>
            <GoogleConnect configured={Boolean(status.data?.googleConfigured)} run={run} busy={busy} onError={onError} />
          </details>
        </section>

        <section>
          <h3>Calendars on the screen</h3>
          <CalendarList calendars={calendars} run={run} />
        </section>

        <section>
          <h3>Lists</h3>
          <ul className="cal-settings">
            {lists.data?.map((l) => (
              <li key={l.id}>
                <input className="icon-input" defaultValue={l.icon} onBlur={(e) => e.target.value !== l.icon && run(() => api.updateList(l.id, { icon: e.target.value }))} />
                <input className="cal-name" defaultValue={l.name} onBlur={(e) => e.target.value !== l.name && run(() => api.updateList(l.id, { name: e.target.value }))} />
                <button className="text-btn" onClick={() => confirm(`Delete the ${l.name} list and everything on it?`) && run(() => api.deleteList(l.id))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            className="list-add"
            onSubmit={async (e) => {
              e.preventDefault()
              if (newList.trim() && (await run(() => api.addList(newList)))) setNewList('')
            }}
          >
            <input placeholder="New list, e.g. Chores" value={newList} onChange={(e) => setNewList(e.target.value)} />
            <button className="primary-btn">Add list</button>
          </form>
        </section>

        <section>
          <h3>Screen</h3>
          <div className="form">
            <label className="field row">
              <span>Show art after</span>
              <select value={settings.idleSeconds} onChange={(e) => save({ idleSeconds: Number(e.target.value) })}>
                {[30, 60, 120, 300, 600, 1800].map((s) => (
                  <option key={s} value={s}>
                    {s < 60 ? `${s} seconds` : `${s / 60} minute${s > 60 ? 's' : ''}`}
                  </option>
                ))}
              </select>
              <span>without a touch</span>
            </label>
            <label className="field row">
              <span>Change artwork every</span>
              <select value={settings.artSeconds} onChange={(e) => save({ artSeconds: Number(e.target.value) })}>
                {[60, 300, 900, 3600, 21600].map((s) => (
                  <option key={s} value={s}>
                    {s < 3600 ? `${s / 60} min` : `${s / 3600} hour${s > 3600 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="field row toggle">
              <input type="checkbox" checked={settings.artClock} onChange={(e) => save({ artClock: e.target.checked })} />
              <span>Small clock over the art</span>
            </label>
            <label className="field row">
              <span>Art</span>
              <select value={settings.artSource} onChange={(e) => save({ artSource: e.target.value as Settings['artSource'] })}>
                <option value="aic">My art/ folder + public-domain paintings</option>
                <option value="local">Only my art/ folder</option>
              </select>
            </label>
            {settings.artSource === 'aic' && (
              <label className="field row">
                <span>Paintings of</span>
                <input defaultValue={settings.artQuery} onBlur={(e) => e.target.value !== settings.artQuery && save({ artQuery: e.target.value })} placeholder="landscape, sea, impressionism…" />
              </label>
            )}
            <label className="field row">
              <span>Screen off from</span>
              <input type="time" value={settings.nightStart} onChange={(e) => save({ nightStart: e.target.value })} />
              <span>to</span>
              <input type="time" value={settings.nightEnd} onChange={(e) => save({ nightEnd: e.target.value })} />
            </label>
          </div>
        </section>

        <section>
          <h3>Setup</h3>
          <button className="secondary-btn" onClick={() => save({ setupDone: false }).then(onClose)}>
            Run the setup guide again
          </button>
        </section>
      </div>
    </div>
  )
}
