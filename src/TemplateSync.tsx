"use client"

import { useState } from 'react'
import type { Account } from './domain'
import { weekdayLabel } from './schedule'
import type { FieldChange, TemplateChange } from './server/template-sync'

const money = (cents: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(cents / 100)
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${Number(value.slice(8))}-го` : 'в течение месяца'

function fieldValue(field: FieldChange, value: FieldChange['before'], accounts: Account[]) {
  if (value === null || value === '') return '—'
  if (field.format === 'money') return money(Number(value))
  if (field.format === 'account') return accounts.find((account) => account.id === value)?.name ?? 'другой счёт'
  if (field.format === 'date') return date(String(value))
  if (field.format === 'schedule') return String(value).startsWith('weekly:') ? `по дням: ${weekdayLabel(String(value).slice(7).split(',').map(Number))}` : 'каждый месяц'
  return String(value)
}

const amountOf = (change: TemplateChange) => change.type === 'add' ? money(change.after.amount) : ''

export default function TemplateSync({ changes, accounts, onApply, onClose }: {
  changes: TemplateChange[]; accounts: Account[]
  onApply: (selected: TemplateChange[]) => void; onClose: () => void
}) {
  const [selected, setSelected] = useState(() => new Set(changes.map((change) => change.key)))
  const toggle = (key: string) => setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const groups = [
    { title: 'Новые в справочнике', hint: 'Добавятся в этот месяц', items: changes.filter((change) => change.type === 'add') },
    { title: 'Изменились в справочнике', hint: 'Если сумму в этом месяце вы меняли сами, снимите галочку, чтобы её сохранить', items: changes.filter((change) => change.type === 'update') },
    { title: 'Больше нет в справочнике', hint: 'Будут убраны из этого месяца', items: changes.filter((change) => change.type === 'remove') },
  ].filter((group) => group.items.length > 0)

  return <section className="panel template-sync" aria-labelledby="template-sync-title">
    <div className="payment-group-head"><div><h2 id="template-sync-title">Обновить из справочника</h2><small>Сравнение этого месяца со справочником. Меняется только то, что отмечено; разовые платежи не затрагиваются.</small></div></div>
    {changes.length === 0 && <div className="empty-state">Месяц совпадает со справочником — обновлять нечего.</div>}
    {groups.map((group) => <div className="sync-group" key={group.title}>
      <h3>{group.title}<small>{group.hint}</small></h3>
      {group.items.map((change) => <label className="sync-item" key={change.key}>
        <input type="checkbox" checked={selected.has(change.key)} onChange={() => toggle(change.key)} />
        <span>
          <strong>{change.kind === 'income' ? 'Доход' : 'Платёж'} · {change.name}</strong>
          {change.type === 'add' && <small>{amountOf(change)}</small>}
          {change.type === 'update' && <span className="sync-fields">{change.fields.map((field) => <small key={field.label}>{field.label}: {fieldValue(field, field.before, accounts)} → <b>{fieldValue(field, field.after, accounts)}</b></small>)}</span>}
          {change.type !== 'add' && change.excluded && <small>Исключён в этом месяце{change.type === 'update' ? ' и останется исключённым' : ''}</small>}
        </span>
      </label>)}
    </div>)}
    <div className="form-actions">
      {changes.length > 0 && <button className="primary-button" type="button" disabled={selected.size === 0} onClick={() => onApply(changes.filter((change) => selected.has(change.key)))}>Применить выбранное ({selected.size})</button>}
      <button className="secondary-button" type="button" onClick={onClose}>{changes.length ? 'Отмена' : 'Закрыть'}</button>
    </div>
  </section>
}
