import { useState } from 'react'
import { api } from '../api.ts'
import { usePolled } from '../hooks.ts'
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
  const [icloud, setIcloud] = useState({ label: '', username: '', password: '', serverUrl: '' })
  const [googlePaste, setGooglePaste] = useState('')
  const [googleUrl, setGoogleUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newList, setNewList] = useState('')

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      accounts.reload()
      lists.reload()
      onChanged()
      return true
    } catch (err) {
      onError((err as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

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
          Tip: it's easier to set this up from a phone or laptop on the same Wi-Fi — open <strong>http://{location.host}</strong>.
        </p>

        <section>
          <h3>Connected calendars</h3>
          <ul className="accounts">
            {accounts.data?.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.label}</strong> <span className="muted">{a.provider === 'caldav' ? 'iCloud / CalDAV' : a.provider === 'google' ? 'Google' : 'Built in'}</span>
                  {a.lastError ? <div className="error-text">⚠ {a.lastError}</div> : a.lastSyncedAt && <div className="muted">Synced {new Date(a.lastSyncedAt).toLocaleTimeString('en-AU')}</div>}
                </div>
                {a.provider !== 'local' && (
                  <button className="text-btn" disabled={busy} onClick={() => confirm(`Disconnect ${a.label}?`) && run(() => api.removeAccount(a.id))}>
                    Disconnect
                  </button>
                )}
              </li>
            ))}
          </ul>

          <details>
            <summary>Add an iPhone (iCloud) calendar</summary>
            <p className="hint">
              Use your Apple ID email and an <strong>app-specific password</strong> from account.apple.com → Sign-In and Security → App-Specific Passwords. Your normal Apple password won't work.
            </p>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault()
                if (await run(() => api.addCalDav(icloud))) setIcloud({ label: '', username: '', password: '', serverUrl: '' })
              }}
            >
              <input placeholder="Whose is it? e.g. Jack" value={icloud.label} onChange={(e) => setIcloud({ ...icloud, label: e.target.value })} />
              <input placeholder="Apple ID email" type="email" autoCapitalize="off" value={icloud.username} onChange={(e) => setIcloud({ ...icloud, username: e.target.value })} />
              <input placeholder="App-specific password (xxxx-xxxx-xxxx-xxxx)" type="password" value={icloud.password} onChange={(e) => setIcloud({ ...icloud, password: e.target.value })} />
              <input placeholder="Server (leave blank for iCloud)" type="url" value={icloud.serverUrl} onChange={(e) => setIcloud({ ...icloud, serverUrl: e.target.value })} />
              <button className="primary-btn" disabled={busy}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </form>
          </details>

          <details>
            <summary>Add a Google calendar</summary>
            {status.data && !status.data.googleConfigured ? (
              <p className="hint">Google needs a one-off setup first (a free Google Cloud "OAuth client"). Follow docs/03-calendars.md, then restart the planner.</p>
            ) : (
              <div className="form">
                <button className="primary-btn" disabled={busy} onClick={async () => setGoogleUrl((await api.googleStart()).url)}>
                  1. Get sign-in link
                </button>
                {googleUrl && (
                  <>
                    <a className="link-box" href={googleUrl} target="_blank" rel="noreferrer">
                      2. Open this link and sign in with Google
                    </a>
                    <p className="hint">
                      If you're doing this on the wall screen itself, you'll come straight back here. On another device the last page will say it can't connect — copy that page's full address and paste it below.
                    </p>
                    <input placeholder="Paste the http://localhost… address here" value={googlePaste} onChange={(e) => setGooglePaste(e.target.value)} />
                    <button className="primary-btn" disabled={busy || !googlePaste} onClick={async () => (await run(() => api.googleCode(googlePaste))) && (setGooglePaste(''), setGoogleUrl(null))}>
                      3. Finish
                    </button>
                  </>
                )}
              </div>
            )}
          </details>
        </section>

        <section>
          <h3>Calendars on the screen</h3>
          <ul className="cal-settings">
            {calendars.map((c) => (
              <li key={c.id}>
                <label className="toggle">
                  <input type="checkbox" checked={c.enabled} onChange={(e) => run(() => api.updateCalendar(c.id, { enabled: e.target.checked }))} />
                </label>
                <input type="color" value={c.color} onChange={(e) => run(() => api.updateCalendar(c.id, { color: e.target.value }))} />
                <span className="cal-name">
                  {c.name}
                  {!c.writable && <span className="muted"> (read-only)</span>}
                </span>
                <input className="person-input" defaultValue={c.person} placeholder="Person" onBlur={(e) => e.target.value !== c.person && run(() => api.updateCalendar(c.id, { person: e.target.value }))} />
              </li>
            ))}
          </ul>
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
      </div>
    </div>
  )
}
