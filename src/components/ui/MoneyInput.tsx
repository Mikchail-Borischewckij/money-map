"use client"

import { useState } from 'react'
import { cx } from '@/lib/format'

const format = (value: number) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value)

// Amount in złoty with up to two decimals. Keeps the typed text while focused so "12," does not jump to "12".
export default function MoneyInput({ value, onChange, label, disabled, autoFocus }: { value: number; onChange: (value: number) => void; label: string; disabled?: boolean; autoFocus?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const shown = focused ? draft : format(value)
  return <label className={cx('money-input', disabled && 'is-disabled')}>
    <input aria-label={label} inputMode="decimal" autoComplete="off" value={shown} disabled={disabled} autoFocus={autoFocus}
      onFocus={(event) => { setDraft(value === 0 ? '' : String(value).replace('.', ',')); setFocused(true); requestAnimationFrame(() => event.target.select()) }}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        const raw = event.target.value.replace(/\s/g, '')
        if (!/^\d*([.,]\d{0,2})?$/.test(raw)) return
        setDraft(raw)
        const amount = Number(raw.replace(',', '.') || 0)
        if (Number.isFinite(amount)) onChange(amount)
      }} />
    <span>zł</span>
  </label>
}
