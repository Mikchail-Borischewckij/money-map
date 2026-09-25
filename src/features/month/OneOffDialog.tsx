"use client"

import { useState } from 'react'
import { Button, Dialog, Field, MoneyInput, Select, TextInput } from '@/components/ui'
import type { Account } from '@/lib/domain'
import { dayOptions } from '@/lib/format'
import { dayInMonth } from './utils'

export type OneOffValue = { name: string; amount: number; accountId: string; day: number | null; category: string }

export default function OneOffDialog({ kind, month, accounts, categories, onClose, onSave }: {
  kind: 'income' | 'payment'; month: string; accounts: Account[]; categories: string[]
  onClose: () => void; onSave: (value: OneOffValue) => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [day, setDay] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const save = () => {
    if (!name.trim()) { setError('Введите название.'); return }
    if (!accountId) { setError('Выберите счёт.'); return }
    onSave({ name: name.trim(), amount, accountId, day: day ? Number(day) : null, category })
  }
  const lastDay = Number(dayInMonth(month, 31).slice(8))
  return <Dialog title={kind === 'income' ? 'Разовый доход' : 'Разовый платёж'} onClose={onClose}
    actions={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" onClick={save}>Добавить</Button></>}>
    <form className="form-grid" onSubmit={(event) => { event.preventDefault(); save() }}>
      <Field label="Название" wide><TextInput label="Название" value={name} onChange={setName} autoFocus /></Field>
      <Field label="Сумма"><MoneyInput label="Сумма" value={amount} onChange={setAmount} /></Field>
      <Field label={kind === 'income' ? 'На счёт' : 'Со счёта'}><Select label="Счёт" value={accountId} options={accounts.map((account) => ({ value: account.id, label: account.name }))} onChange={setAccountId} /></Field>
      <Field label="Когда"><Select label="Когда" value={day} options={dayOptions.slice(0, lastDay + 1)} onChange={setDay} /></Field>
      {kind === 'payment' && <Field label="Категория"><Select label="Категория" value={category} placeholder="Без категории" options={[{ value: '', label: 'Без категории' }, ...categories.map((item) => ({ value: item, label: item }))]} onChange={setCategory} /></Field>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="note field-wide">Только в этом месяце. Повторяющиеся — в настройках.</p>
      <button type="submit" hidden />
    </form>
  </Dialog>
}
