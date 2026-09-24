import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { fmtTime } from '../dates.ts'
import { useNow } from '../hooks.ts'
import type { Artwork, Settings } from '../../../shared/types.ts'

/**
 * Full-screen gallery shown when nobody has touched the screen for a while.
 * Any touch wakes the planner; the touch itself is swallowed so it doesn't press whatever is underneath.
 */
export function ArtMode({ settings, onWake }: { settings: Settings; onWake: () => void }) {
  const [art, setArt] = useState<Artwork[]>([])
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState<[Artwork | null, Artwork | null]>([null, null])
  const [front, setFront] = useState(0)
  const now = useNow(30_000)

  useEffect(() => {
    api.art().then((list) => {
      // Shuffle so the same painting doesn't always come first.
      const shuffled = [...list].sort(() => Math.random() - 0.5)
      setArt(shuffled)
      setIndex(0)
    }, () => setArt([]))
  }, [])

  useEffect(() => {
    if (art.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % art.length), settings.artSeconds * 1000)
    return () => clearInterval(t)
  }, [art.length, settings.artSeconds])

  // Preload the next image, then cross-fade to it.
  useEffect(() => {
    const next = art[index]
    if (!next) return
    const img = new Image()
    img.onload = () => {
      setShown((s) => {
        const back = 1 - front
        const copy: [Artwork | null, Artwork | null] = [...s]
        copy[back] = next
        return copy
      })
      setFront((f) => 1 - f)
    }
    img.src = next.url
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art, index])

  const current = shown[front]

  return (
    <div
      className="art"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onWake()
      }}
    >
      {shown.map((work, i) =>
        work ? (
          <div key={i} className={`art-layer ${i === front ? 'visible' : ''}`}>
            <img src={work.url} alt={work.title} draggable={false} />
          </div>
        ) : null,
      )}
      {!art.length && <div className="art-empty">{fmtTime(now)}</div>}
      <div className="art-caption">
        {current && (
          <span>
            {current.title}
            {current.artist && <em> — {current.artist}</em>}
          </span>
        )}
        {settings.artClock && art.length > 0 && <span className="art-clock">{fmtTime(now)}</span>}
      </div>
    </div>
  )
}
