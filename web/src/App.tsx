import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.ts'
import { addDays, startOfDay } from './dates.ts'
import { usePolled } from './hooks.ts'
import { ArtMode } from './components/ArtMode.tsx'
import { Header } from './components/Header.tsx'
import { WeekView } from './components/WeekView.tsx'
import { MonthView } from './components/MonthView.tsx'
import { ListsPanel } from './components/ListsPanel.tsx'
import { EventEditor, type EditorState } from './components/EventEditor.tsx'
import { SettingsPanel } from './components/SettingsPanel.tsx'
import { OnScreenKeyboard } from './components/OnScreenKeyboard.tsx'
import { SetupWizard } from './components/SetupWizard.tsx'
import type { Settings } from '../../shared/types.ts'

type View = 'week' | 'month'

export function App() {
  const params = new URLSearchParams(location.search)
  const [mode, setMode] = useState<'art' | 'planner'>('planner')
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [showSettings, setShowSettings] = useState(params.has('settings'))
  const [toast, setToast] = useState<string | null>(params.get('error'))

  // Check often while setup is unfinished, so the wall switches over as soon as it's completed on a laptop.
  const [settingsInterval, setSettingsInterval] = useState(5 * 60_000)
  const settings = usePolled<Settings>(api.settings, settingsInterval)
  const inSetup = settings.data?.setupDone === false
  useEffect(() => setSettingsInterval(inSetup ? 5_000 : 5 * 60_000), [inSetup])
  const calendars = usePolled(api.calendars, 5 * 60_000)

  // Fetch the visible range with a margin either side so paging feels instant.
  const range = useMemo(() => {
    if (view === 'week') return { from: addDays(anchor, -7), to: addDays(anchor, 14) }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    return { from: addDays(first, -7), to: addDays(first, 45) }
  }, [view, anchor])
  const events = usePolled(() => api.events(range.from, range.to), 60_000, [range.from.getTime(), range.to.getTime()])

  const refreshAll = useCallback(() => {
    events.reload()
    calendars.reload()
  }, [events, calendars])

  // ----- Idle → art mode -----
  const lastTouch = useRef(Date.now())
  const inSetupRef = useRef(inSetup)
  inSetupRef.current = inSetup
  useEffect(() => {
    const touched = () => (lastTouch.current = Date.now())
    window.addEventListener('pointerdown', touched, true)
    window.addEventListener('keydown', touched, true)
    const t = setInterval(() => {
      const idleMs = (settings.data?.idleSeconds ?? 120) * 1000
      if (Date.now() - lastTouch.current > idleMs && !inSetupRef.current) {
        setMode('art')
        setEditor(null)
        setShowSettings(false)
        setView('week')
        setAnchor(startOfDay(new Date()))
      }
    }, 5000)
    return () => {
      window.removeEventListener('pointerdown', touched, true)
      window.removeEventListener('keydown', touched, true)
      clearInterval(t)
    }
  }, [settings.data?.idleSeconds])

  const wake = useCallback(() => {
    lastTouch.current = Date.now()
    setMode('planner')
    refreshAll()
  }, [refreshAll])

  // ----- Reload the page after the app is updated on the Pi (server restarts with a new bootId) -----
  useEffect(() => {
    let bootId: string | null = null
    const check = async () => {
      try {
        const status = await api.status()
        if (bootId && status.bootId !== bootId) location.reload()
        bootId = status.bootId
      } catch {
        /* server restarting */
      }
    }
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const cals = calendars.data ?? []
  const shift = (dir: number) =>
    setAnchor((a) => (view === 'week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)))

  return (
    <div className="app">
      <Header
        view={view}
        onView={(v) => {
          setView(v)
          setAnchor(startOfDay(new Date()))
        }}
        anchor={anchor}
        onShift={shift}
        onToday={() => setAnchor(startOfDay(new Date()))}
        onAdd={() => setEditor({ day: anchor })}
        onSettings={() => setShowSettings(true)}
        onSync={async () => {
          await api.sync().catch((e) => setToast(e.message))
          refreshAll()
        }}
      />
      <main className="main">
        <section className="calendar-area">
          {view === 'week' ? (
            <WeekView start={anchor} events={events.data ?? []} calendars={cals} onEvent={(event) => setEditor({ event })} onDay={(day) => setEditor({ day })} />
          ) : (
            <MonthView
              month={anchor}
              events={events.data ?? []}
              calendars={cals}
              onDay={(day) => {
                setView('week')
                setAnchor(day)
              }}
            />
          )}
        </section>
        <ListsPanel onError={setToast} />
      </main>

      {editor && (
        <EventEditor
          state={editor}
          calendars={cals}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            events.reload()
          }}
          onError={setToast}
        />
      )}
      {showSettings && settings.data && (
        <SettingsPanel
          settings={settings.data}
          calendars={cals}
          onSettings={(s) => settings.setData(s)}
          onChanged={refreshAll}
          onClose={() => setShowSettings(false)}
          onError={setToast}
        />
      )}
      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
      {inSetup && (
        <SetupWizard
          calendars={cals}
          onChanged={refreshAll}
          onDone={() => {
            settings.reload()
            refreshAll()
          }}
          onError={setToast}
        />
      )}
      <OnScreenKeyboard />
      {mode === 'art' && settings.data && <ArtMode settings={settings.data} onWake={wake} />}
    </div>
  )
}
