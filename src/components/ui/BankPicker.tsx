"use client"

import { bankOptions, type BankId } from '@/lib/banks'
import { cx } from '@/lib/format'
import BankIcon from './BankIcon'

export default function BankPicker({ value, onChange }: { value: BankId | ''; onChange: (bank: BankId) => void }) {
  return <div className="bank-picker" role="radiogroup" aria-label="Банк">
    {bankOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value}
      className={cx('bank-option', value === option.value && 'is-selected')} onClick={() => onChange(option.value)}>
      <BankIcon bank={option.value} size="lg" />
      <span>{option.label}</span>
    </button>)}
  </div>
}
