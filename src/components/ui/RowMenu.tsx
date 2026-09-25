"use client"

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import Button from './Button'

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean }

export default function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey) }
  }, [open])
  if (items.length === 0) return null
  return <div className="row-menu" ref={root}>
    <Button variant="ghost" size="sm" aria-label={label} aria-haspopup="menu" aria-expanded={open} icon={<MoreHorizontal size={18} />} onClick={() => setOpen(!open)} />
    {open && <div className="row-menu-list" role="menu">
      {items.map((item) => <button key={item.label} type="button" role="menuitem" className={item.danger ? 'is-danger' : ''} onClick={() => { setOpen(false); item.onSelect() }}>{item.label}</button>)}
    </div>}
  </div>
}
