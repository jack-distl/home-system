import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../api.ts'
import { isKiosk, usePolled } from '../hooks.ts'
import type { Calendar } from '../../../shared/types.ts'
import { AccountList, CalendarList, GoogleConnect, ICloudConnect, useRunner } from './Connect.tsx'

interface Props {
  calendars: Calendar[]
  onChanged: () => void
  onDone: () => void
  onError: (msg: string) => void
}

const STEPS = ['Welcome', 'iPhone calendar', 'Google calendar', 'Choose calendars', 'Done'] as const

/**
 * First-run guide. On the wall it points people to a laptop (typing passwords is much easier there);
 * on a laptop or phone it walks through connecting each calendar. Whichever device finishes it,
 * the wall screen notices and switches to the planner.
 */
export function SetupWizard({ calendars, onChanged, onDone, onError }: Props) {
  const [step, setStep] = useState(0)
  const [continueHere, setContinueHere] = useState(false)
  const status = usePolled(api.status, 10_000)
  const accounts = usePolled(api.accounts, 10_000)
  const { busy, run } = useRunner(onError, () => {
    accounts.reload()
    status.reload()
    onChanged()
  })

  const connected = accounts.data ?? []
  const icloud = connected.filter((a) => a.provider === 'caldav')
  const google = connected.filter((a) => a.provider === 'google')
  const finish = () => run(() => api.saveSettings({ setupDone: true })).then((ok) => ok && onDone())

  if (isKiosk && !continueHere) {
    return (
      <div className="wizard">
        <div className="wizard-card wall">
          <h1>Let's set up your planner</h1>
          <p className="lead">Grab a laptop (or phone) that's on the same Wi-Fi and open:</p>
          <p className="address">{status.data?.addresses[0] ?? '…'}</p>
          <Qr url={status.data?.addresses[0]} />
          {status.data && status.data.addresses.length > 1 && <p className="hint">If that doesn't open, try {status.data.addresses[1]}</p>}
          <p className="hint">The guide will continue there, and this screen will switch to your planner by itself when you're finished.</p>
          <div className="wizard-actions">
            <button className="text-btn" onClick={() => setContinueHere(true)}>
              Continue on this screen instead
            </button>
            <button className="text-btn" onClick={finish}>
              Skip setup for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard">
      <div className="wizard-card">
        <ol className="wizard-progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'current' : i < step ? 'past' : ''}>
              {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <>
            <h1>Welcome 👋</h1>
            <p className="lead">This takes about 20 minutes. We'll connect:</p>
            <ul className="lead">
              <li>
                <strong>the iPhone's calendar</strong> (about 5 minutes), and
              </li>
              <li>
                <strong>the Google calendar</strong> (about 15 minutes, only the first time).
              </li>
            </ul>
            <p className="hint">
              Once connected, anything added on your phones shows up on the wall, and anything added on the wall shows up on your phones. If you get stuck, you can skip a step and come back later from
              ⚙ Settings → "Run the setup guide again".
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <h1>Connect the iPhone calendar</h1>
            {icloud.length > 0 && (
              <div className="success">
                <strong>Connected ✓</strong>
                <AccountList accounts={icloud} run={run} busy={busy} />
                <p className="hint">Got another iPhone in the house? Fill in the form again. Otherwise press Next.</p>
              </div>
            )}
            <ICloudConnect run={run} busy={busy} />
          </>
        )}

        {step === 2 && (
          <>
            <h1>Connect the Google calendar</h1>
            {google.length > 0 && (
              <div className="success">
                <strong>Connected ✓</strong>
                <AccountList accounts={google} run={run} busy={busy} />
              </div>
            )}
            {status.data && <GoogleConnect configured={status.data.googleConfigured} run={run} busy={busy} onError={onError} />}
          </>
        )}

        {step === 3 && (
          <>
            <h1>Choose what shows on the wall</h1>
            <p className="hint">
              Untick calendars you don't want on the wall (e.g. work, or "Birthdays" duplicates). Tap the colour square to change a colour, and check the name on the right — it's shown on every event so
              you can tell whose it is.
            </p>
            <CalendarList calendars={calendars} run={run} />
            <p className="hint">
              "Home" is a built-in calendar that only lives on the wall. If you'd rather new events go to one of your real calendars, untick it.
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <h1>All done 🎉</h1>
            <p className="lead">Press Finish and the wall screen will switch to your planner.</p>
            <ul className="lead">
              <li>Tap an empty part of a day to add something, or tap an event to change it.</li>
              <li>After two minutes without a touch it shows paintings. Touch anywhere to wake it.</li>
              <li>
                Add this page to your phone's home screen (Share → <em>Add to Home Screen</em>) to add to the shopping list from the couch.
              </li>
            </ul>
          </>
        )}

        <div className="wizard-actions">
          {step > 0 && (
            <button className="secondary-btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <span className="spacer" />
          {step > 0 && step < 3 && (
            <button className="text-btn" onClick={() => setStep(step + 1)}>
              Skip this step
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="primary-btn" onClick={() => setStep(step + 1)}>
              {step === 0 ? "Let's start" : 'Next'}
            </button>
          ) : (
            <button className="primary-btn" disabled={busy} onClick={finish}>
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Qr({ url }: { url?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    if (url) QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#2b2a27', light: '#fbf9f4' } }).then(setSvg, () => setSvg(''))
  }, [url])
  if (!svg) return null
  return (
    <div className="qr">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="hint">Scan with a phone camera</span>
    </div>
  )
}
