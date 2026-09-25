"use client"

import { useState } from 'react'
import { weekdayNames } from './schedule'

export function AmountInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(String(value))
  return <input aria-label={label} type="text" inputMode="decimal" value={focused ? draft : String(value)} onFocus={() => { setDraft(String(value)); setFocused(true) }} onBlur={() => setFocused(false)} onChange={(event) => {
    const raw = event.target.value
    if (!/^\d*([.,]\d{0,2})?$/.test(raw)) return
    setDraft(raw)
    const amount = Number(raw.replace(',', '.'))
    if (Number.isFinite(amount)) onChange(amount)
  }} />
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (value: number[]) => void }) {
  return <div className="weekday-picker" role="group" aria-label="Дни недели">
    {weekdayNames.map((name, index) => {
      const day = index + 1
      const active = value.includes(day)
      return <button key={day} type="button" aria-pressed={active} className={active ? 'active' : ''} onClick={() => onChange(active ? value.filter((item) => item !== day) : [...value, day].sort())}>{name}</button>
    })}
  </div>
}
