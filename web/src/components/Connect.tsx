import { useState } from 'react'
import { api } from '../api.ts'
import type { Account, Calendar } from '../../../shared/types.ts'

// Building blocks shared by the first-run setup screen and Settings.

type Run = (fn: () => Promise<unknown>) => Promise<boolean>

export function useRunner(onError: (msg: string) => void, after: () => void) {
  const [busy, setBusy] = useState(false)
  const run: Run = async (fn) => {
    setBusy(true)
    try {
      await fn()
      after()
      return true
    } catch (err) {
      onError((err as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

export function AccountList({ accounts, run, busy }: { accounts: Account[]; run: Run; busy: boolean }) {
  return (
    <ul className="accounts">
      {accounts.map((a) => (
        <li key={a.id}>
          <div>
            <strong>{a.label}</strong> <span className="muted">{a.provider === 'caldav' ? 'iPhone / iCloud' : a.provider === 'google' ? 'Google' : 'Built in'}</span>
            {a.lastError ? <div className="error-text">⚠ {a.lastError}</div> : a.lastSyncedAt && <div className="muted">✓ Synced {new Date(a.lastSyncedAt).toLocaleTimeString('en-AU')}</div>}
          </div>
          {a.provider !== 'local' && (
            <button className="text-btn" disabled={busy} onClick={() => confirm(`Disconnect ${a.label}?`) && run(() => api.removeAccount(a.id))}>
              Disconnect
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function ICloudConnect({ run, busy }: { run: Run; busy: boolean }) {
  const [form, setForm] = useState({ label: '', username: '', password: '', serverUrl: '' })
  const [advanced, setAdvanced] = useState(false)
  return (
    <div className="steps">
      <ol>
        <li>
          On a computer, go to <a href="https://account.apple.com" target="_blank" rel="noreferrer">account.apple.com</a> and sign in with the Apple ID used on the iPhone.
        </li>
        <li>
          Click <strong>Sign-In and Security</strong>, then <strong>App-Specific Passwords</strong>, then the <strong>+</strong> button.
        </li>
        <li>
          Name it <strong>Home planner</strong> and click Create. Apple shows a password like <code>abcd-efgh-ijkl-mnop</code>. Copy it.
        </li>
        <li>Fill in the boxes below and press Connect. (Your normal Apple password won't work here — it must be the new one.)</li>
      </ol>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await run(() => api.addCalDav(form))) setForm({ label: '', username: '', password: '', serverUrl: '' })
        }}
      >
        <input placeholder="Whose calendar is it? e.g. Jack" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
        <input placeholder="Apple ID email" type="email" autoCapitalize="off" autoCorrect="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input placeholder="App-specific password (abcd-efgh-ijkl-mnop)" autoCapitalize="off" autoCorrect="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {advanced ? (
          <input placeholder="CalDAV server address (only for non-Apple calendars)" type="url" value={form.serverUrl} onChange={(e) => setForm({ ...form, serverUrl: e.target.value })} />
        ) : (
          <button type="button" className="text-btn left" onClick={() => setAdvanced(true)}>
            Not an Apple calendar?
          </button>
        )}
        <button className="primary-btn" disabled={busy}>
          {busy ? 'Connecting… (takes a few seconds)' : 'Connect'}
        </button>
      </form>
    </div>
  )
}

const gcp = (path: string) => `https://console.cloud.google.com/${path}`

function GoogleRegister({ run, busy }: { run: Run; busy: boolean }) {
  const [form, setForm] = useState({ clientId: '', clientSecret: '' })
  const redirect = 'http://localhost:3000/api/oauth/google/callback'
  return (
    <div className="steps">
      <p className="hint">
        Google makes every app register once before it can use a calendar. It's free and takes about 15 minutes — do it on a computer. You only ever do this once.
      </p>
      <ol>
        <li>
          Open <a href={gcp('projectcreate')} target="_blank" rel="noreferrer">Create a project</a> and sign in with the Google account. Name it <strong>Home planner</strong> and click <strong>Create</strong>. Wait
          for the notification that it's ready.
        </li>
        <li>
          Open <a href={gcp('apis/library/calendar-json.googleapis.com')} target="_blank" rel="noreferrer">Google Calendar API</a>. Check the project picker at the top says "Home planner", then click{' '}
          <strong>Enable</strong>.
        </li>
        <li>
          Open <a href={gcp('auth/overview')} target="_blank" rel="noreferrer">Google Auth Platform</a> and click <strong>Get started</strong>:
          <ul>
            <li>App name: <strong>Home planner</strong>. User support email: yours. <strong>Next</strong>.</li>
            <li>Audience: <strong>External</strong>. <strong>Next</strong>.</li>
            <li>Contact email: yours. <strong>Next</strong>. Tick to agree, then <strong>Create</strong>.</li>
          </ul>
        </li>
        <li>
          Open <a href={gcp('auth/audience')} target="_blank" rel="noreferrer">Audience</a> and click <strong>Publish app</strong>, then <strong>Confirm</strong>. It should now say "In production".
          <div className="warn">Don't skip this — otherwise Google disconnects the calendar every 7 days. It doesn't make anything public.</div>
        </li>
        <li>
          Open <a href={gcp('auth/clients/create')} target="_blank" rel="noreferrer">Create client</a>:
          <ul>
            <li>Application type: <strong>Web application</strong>. Name: anything.</li>
            <li>
              Under <strong>Authorised redirect URIs</strong> click <strong>+ Add URI</strong> and paste exactly:
              <CopyBox text={redirect} />
            </li>
            <li>Click <strong>Create</strong>. A box shows your <strong>Client ID</strong> and <strong>Client secret</strong>.</li>
          </ul>
        </li>
        <li>Copy both into the boxes below and press Save.</li>
      </ol>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => api.saveGoogleClient(form.clientId, form.clientSecret))
        }}
      >
        <input placeholder="Client ID (ends in .apps.googleusercontent.com)" autoCapitalize="off" autoCorrect="off" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required />
        <input placeholder="Client secret (starts with GOCSPX-)" autoCapitalize="off" autoCorrect="off" value={form.clientSecret} onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} required />
        <button className="primary-btn" disabled={busy}>
          Save
        </button>
      </form>
    </div>
  )
}

function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="copy-box">
      <code>{text}</code>
      <button
        type="button"
        className="text-btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
          } catch {
            /* clipboard needs https on some browsers; the text is selectable anyway */
          }
        }}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </span>
  )
}

export function GoogleConnect({ configured, run, busy, onError }: { configured: boolean; run: Run; busy: boolean; onError: (msg: string) => void }) {
  const [person, setPerson] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const onThisDevice = location.hostname === 'localhost'

  if (!configured) return <GoogleRegister run={run} busy={busy} />

  return (
    <div className="steps">
      <ol>
        <li>
          <input placeholder="Whose calendar is it? e.g. Sarah" value={person} onChange={(e) => setPerson(e.target.value)} />
        </li>
        <li>
          <button
            className="primary-btn"
            disabled={busy || !person.trim()}
            onClick={async () => {
              try {
                setLink((await api.googleStart(person)).url)
              } catch (err) {
                onError((err as Error).message)
              }
            }}
          >
            Get sign-in link
          </button>
        </li>
        {link && (
          <>
            <li>
              <a className="link-box" href={link} target={onThisDevice ? undefined : '_blank'} rel="noreferrer">
                Open Google sign-in →
              </a>
              Choose the Google account. When Google says <em>"Google hasn't verified this app"</em>, click <strong>Advanced</strong>, then <strong>Go to Home planner (unsafe)</strong> — it's your own
              app, so that's expected. Then tick the calendar permission and click <strong>Continue</strong>.
            </li>
            {!onThisDevice && (
              <li>
                You'll land on a page saying <em>"This site can't be reached"</em>. That's expected! Click in the address bar at the top of that page, copy the <strong>whole address</strong> (it starts
                with <code>http://localhost:3000</code>), come back to this tab and paste it here:
                <div className="form">
                  <input placeholder="Paste the http://localhost:3000/… address" value={pasted} onChange={(e) => setPasted(e.target.value)} autoCapitalize="off" autoCorrect="off" />
                  <button
                    className="primary-btn"
                    disabled={busy || !pasted}
                    onClick={async () => {
                      if (await run(() => api.googleCode(pasted))) {
                        setPasted('')
                        setLink(null)
                        setPerson('')
                      }
                    }}
                  >
                    {busy ? 'Connecting…' : 'Finish'}
                  </button>
                </div>
              </li>
            )}
          </>
        )}
      </ol>
    </div>
  )
}

export function CalendarList({ calendars, run }: { calendars: Calendar[]; run: Run }) {
  return (
    <ul className="cal-settings">
      {calendars.map((c) => (
        <li key={c.id}>
          <label className="toggle" title="Show on the screen">
            <input type="checkbox" checked={c.enabled} onChange={(e) => run(() => api.updateCalendar(c.id, { enabled: e.target.checked }))} />
          </label>
          <input type="color" value={c.color} onChange={(e) => run(() => api.updateCalendar(c.id, { color: e.target.value }))} />
          <span className="cal-name">
            {c.name}
            {!c.writable && <span className="muted"> (read-only)</span>}
          </span>
          <input className="person-input" defaultValue={c.person} placeholder="Whose?" onBlur={(e) => e.target.value !== c.person && run(() => api.updateCalendar(c.id, { person: e.target.value }))} />
        </li>
      ))}
    </ul>
  )
}
