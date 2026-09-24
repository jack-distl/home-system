import { useCallback, useEffect, useRef, useState } from 'react'

/** Load data, and reload it every `intervalMs` and whenever `reload()` is called. */
export function usePolled<T>(load: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef(load)
  loadRef.current = load

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current())
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    reload()
    const t = setInterval(reload, intervalMs)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, intervalMs, ...deps])

  return { data, error, reload, setData }
}

export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** True when the page was opened by the wall screen's kiosk launcher (it adds ?kiosk=1). */
export const isKiosk = new URLSearchParams(location.search).has('kiosk')
