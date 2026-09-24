import { useState } from 'react'
import { api } from '../api.ts'
import { usePolled } from '../hooks.ts'

export function ListsPanel({ onError }: { onError: (msg: string) => void }) {
  const lists = usePolled(api.lists, 30_000)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const all = lists.data ?? []
  const active = all.find((l) => l.id === activeId) ?? all[0]
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      onError((err as Error).message)
    }
    lists.reload()
  }

  const add = () => {
    if (!active || !draft.trim()) return
    const text = draft
    setDraft('')
    run(() => api.addItem(active.id, text))
  }

  const toggle = (id: string, done: boolean) => {
    // Update instantly on screen, then save.
    lists.setData((ls) => ls?.map((l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, done } : i)) })) ?? null)
    run(() => api.updateItem(id, { done }))
  }

  const openCount = (items: { done: boolean }[]) => items.filter((i) => !i.done).length
  const doneCount = active ? active.items.length - openCount(active.items) : 0

  return (
    <aside className="lists">
      <nav className="list-tabs">
        {all.map((l) => (
          <button key={l.id} className={l.id === active?.id ? 'active' : ''} onClick={() => setActiveId(l.id)}>
            <span className="list-icon">{l.icon}</span>
            <span>{l.name}</span>
            {openCount(l.items) > 0 && <span className="badge">{openCount(l.items)}</span>}
          </button>
        ))}
      </nav>
      {active && (
        <div className="list-body">
          <form
            className="list-add"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add to ${active.name.toLowerCase()}…`} enterKeyHint="done" />
            <button type="submit" className="primary-btn" disabled={!draft.trim()}>
              Add
            </button>
          </form>
          <ul className="list-items">
            {active.items.map((item) => (
              <li key={item.id} className={item.done ? 'done' : ''}>
                <button className="check" onClick={() => toggle(item.id, !item.done)}>
                  <span className="box">{item.done ? '✓' : ''}</span>
                  <span className="text">{item.text}</span>
                </button>
                <button className="remove" aria-label="Remove" onClick={() => run(() => api.deleteItem(item.id))}>
                  ×
                </button>
              </li>
            ))}
            {active.items.length === 0 && <li className="list-empty">Nothing here yet</li>}
          </ul>
          {doneCount > 0 && (
            <button className="text-btn" onClick={() => run(() => api.clearDone(active.id))}>
              Clear {doneCount} ticked
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
