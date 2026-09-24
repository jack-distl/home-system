import { useEffect, useRef, useState } from 'react'
import Keyboard from 'react-simple-keyboard'
import { isKiosk } from '../hooks.ts'

type Field = HTMLInputElement | HTMLTextAreaElement
const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'password', ''])

function isTextField(el: Element | null): el is Field {
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)
}

/** Set a value the way typing would, so React's onChange fires. */
function typeInto(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Touch keyboard for the wall screen (only when opened with ?kiosk=1 — phones and laptops use their own).
 * It follows whichever text box has focus.
 */
export function OnScreenKeyboard() {
  const [target, setTarget] = useState<Field | null>(null)
  const [layout, setLayout] = useState<'default' | 'shift'>('shift')
  const keyboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isKiosk) return
    const onFocus = (e: FocusEvent) => {
      if (isTextField(e.target as Element)) {
        setTarget(e.target as Field)
        setLayout((e.target as Field).value ? 'default' : 'shift')
      }
    }
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element
      if (keyboardRef.current?.contains(el) || isTextField(el)) return
      setTarget(null)
    }
    document.addEventListener('focusin', onFocus)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [])

  if (!isKiosk || !target || !document.contains(target)) return null

  const press = (button: string) => {
    const el = target
    const value = el.value
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const insert = (text: string) => {
      typeInto(el, value.slice(0, start) + text + value.slice(end))
      el.setSelectionRange(start + text.length, start + text.length)
    }
    if (button === '{bksp}') {
      const from = start === end ? Math.max(0, start - 1) : start
      typeInto(el, value.slice(0, from) + value.slice(end))
      el.setSelectionRange(from, from)
    } else if (button === '{shift}' || button === '{lock}') {
      setLayout((l) => (l === 'default' ? 'shift' : 'default'))
      return
    } else if (button === '{enter}') {
      if (el instanceof HTMLTextAreaElement) insert('\n')
      else {
        el.form?.requestSubmit()
        setTarget(null)
      }
    } else if (button === '{space}') {
      insert(' ')
    } else if (button === '{hide}') {
      el.blur()
      setTarget(null)
      return
    } else {
      insert(button)
      if (layout === 'shift') setLayout('default')
    }
    el.focus()
  }

  return (
    <div className="osk" ref={keyboardRef} onPointerDown={(e) => e.preventDefault()}>
      <Keyboard
        layoutName={layout}
        onKeyPress={press}
        layout={{
          default: ['1 2 3 4 5 6 7 8 9 0 {bksp}', 'q w e r t y u i o p', 'a s d f g h j k l \' {enter}', '{shift} z x c v b n m , . ? {shift}', '{hide} @ {space} - &'],
          shift: ['1 2 3 4 5 6 7 8 9 0 {bksp}', 'Q W E R T Y U I O P', 'A S D F G H J K L " {enter}', '{shift} Z X C V B N M ! : / {shift}', '{hide} @ {space} - &'],
        }}
        display={{ '{bksp}': '⌫', '{enter}': 'Done', '{shift}': '⇧', '{space}': ' ', '{hide}': '⌄ Hide' }}
        preventMouseDownDefault
      />
    </div>
  )
}
