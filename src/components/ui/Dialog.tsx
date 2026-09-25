"use client"

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Button from './Button'

export default function Dialog({ title, children, onClose, actions }: { title: string; children: React.ReactNode; onClose: () => void; actions: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  // Focus moves into the dialog once on open and returns to where it was on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const body = ref.current?.querySelector('.dialog-body')
    const target = body?.querySelector<HTMLElement>('input, button') ?? ref.current?.querySelector<HTMLElement>('.dialog-actions button:last-child')
    target?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close.current() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [])
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
      <div className="dialog-head"><h2 id="dialog-title">{title}</h2><Button variant="ghost" aria-label="Закрыть" icon={<X size={18} />} onClick={onClose} /></div>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">{actions}</div>
    </div>
  </div>
}
