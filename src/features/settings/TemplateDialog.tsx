"use client"

import { useState } from 'react'
import { Button, Checkbox, Dialog, Field, MoneyInput, Segmented, Select, TextInput, WeekdayPicker } from '@/components/ui'
import { dayOptions } from '@/lib/format'
import type { AccountRow, Category, TemplateForm, TemplateKind } from './types'

const empty = (accountId: string): TemplateForm => ({ name: '', amount: 0, accountId, day: null, categoryId: '', schedule: 'monthly', weekdays: [], amountVaries: false })

export default function TemplateDialog({ kind, value, accounts, categories, onClose, onSave }: { kind: TemplateKind; value: TemplateForm | null; accounts: AccountRow[]; categories: Category[]; onClose: () => void; onSave: (value: TemplateForm) => void }) {
  const [form, setForm] = useState<TemplateForm>(value ?? empty(accounts[0]?.id ?? ''))
  const [error, setError] = useState('')
  const set = (patch: Partial<TemplateForm>) => setForm((current) => ({ ...current, ...patch }))
  const weekly = kind === 'payment' && form.schedule === 'weekly'
  const save = () => {
    if (!form.name.trim()) { setError('Введите название.'); return }
    if (!form.accountId) { setError('Выберите счёт.'); return }
    if (weekly && form.weekdays.length === 0) { setError('Выберите дни недели.'); return }
    onSave({ ...form, name: form.name.trim() })
  }
  const title = value ? value.name : kind === 'payment' ? 'Новый платёж' : 'Новый доход'
  return <Dialog title={title} onClose={onClose} actions={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" onClick={save}>Сохранить</Button></>}>
    <form className="form-grid" onSubmit={(event) => { event.preventDefault(); save() }}>
      <Field label="Название" wide><TextInput label="Название" value={form.name} onChange={(name) => set({ name })} autoFocus={!value} /></Field>
      {kind === 'payment' && <Field label="Как часто" wide><Segmented label="Как часто" value={form.schedule} options={[{ value: 'monthly', label: 'Раз в месяц' }, { value: 'weekly', label: 'По дням недели' }]} onChange={(schedule) => set({ schedule })} /></Field>}
      {weekly
        ? <Field label="Дни недели" wide><WeekdayPicker value={form.weekdays} onChange={(weekdays) => set({ weekdays })} /></Field>
        : <Field label="Число месяца"><Select label="Число месяца" value={form.day ? String(form.day) : ''} options={dayOptions} onChange={(day) => set({ day: day ? Number(day) : null })} /></Field>}
      <Field label={weekly ? 'Цена за раз' : 'Сумма'}><MoneyInput label="Сумма" value={form.amount} onChange={(amount) => set({ amount })} /></Field>
      <Field label={kind === 'payment' ? 'Со счёта' : 'На счёт'}><Select label="Счёт" value={form.accountId} options={accounts.map((account) => ({ value: account.id, label: account.name }))} onChange={(accountId) => set({ accountId })} /></Field>
      <Field label="Категория"><Select label="Категория" value={form.categoryId} placeholder="Без категории" options={[{ value: '', label: 'Без категории' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} onChange={(categoryId) => set({ categoryId })} /></Field>
      {!weekly && <div className="field-wide"><Checkbox checked={form.amountVaries} onChange={(amountVaries) => set({ amountVaries })}>Сумма меняется от месяца к месяцу</Checkbox>
        {form.amountVaries && <p className="note">{kind === 'income'
          ? 'Укажите сумму, на которую можно рассчитывать наверняка. В каждом месяце её нужно будет уточнить, а до этого итог будет предварительным.'
          : 'Укажите примерную сумму. В каждом месяце её нужно будет уточнить, а до этого итог будет предварительным.'}</p>}</div>}
      {weekly && <p className="note field-wide">В месяце: цена × число этих дней. Количество можно поправить в самом месяце.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" hidden />
    </form>
  </Dialog>
}
