"use client"

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cx } from '@/lib/format'
import type { Option } from './option'

// Listbox-style select: button plus popup list, arrow keys, Enter, Escape and click outside.
export default function Select<T extends string>({ value, options, onChange, label, placeholder = 'Выберите', disabled, compact }: { value: T | ''; options: Option<T>[]; onChange: (value: T) => void; label: string; placeholder?: string; disabled?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  // Only keyboard moves scroll the list; scrolling on hover would slide another option under the pointer.
  const keyboard = useRef(false)
  const id = useId()
  const selected = options.find((option) => option.value === value)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  useEffect(() => {
    if (open && keyboard.current) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
    keyboard.current = false
  }, [open, active])
  const show = () => { keyboard.current = true; setActive(Math.max(0, options.findIndex((option) => option.value === value))); setOpen(true) }
  const choose = (index: number) => { const option = options[index]; if (option) onChange(option.value); setOpen(false) }
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Tab') { setOpen(false); return }
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return
    event.preventDefault()
    if (!open) { show(); return }
    keyboard.current = true
    if (event.key === 'ArrowDown') setActive((index) => Math.min(options.length - 1, index + 1))
    if (event.key === 'ArrowUp') setActive((index) => Math.max(0, index - 1))
    if (event.key === 'Enter' || event.key === ' ') choose(active)
  }
  return <div className={cx('select', compact && 'select-compact', open && 'is-open')} ref={root}>
    <button type="button" className="select-button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} disabled={disabled}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={onKey}>
      <span className={selected ? '' : 'placeholder'}>{selected?.label ?? placeholder}</span><ChevronDown size={16} />
    </button>
    {open && <ul className="select-list" role="listbox" id={id} ref={list} aria-label={label}>
      {options.map((option, index) => <li key={option.value} role="option" aria-selected={option.value === value} className={cx(index === active && 'is-active', option.value === value && 'is-selected')}
        onMouseEnter={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); choose(index) }}>
        <span>{option.label}{option.hint && <small>{option.hint}</small>}</span>{option.value === value && <Check size={15} />}
      </li>)}
    </ul>}
  </div>
}
