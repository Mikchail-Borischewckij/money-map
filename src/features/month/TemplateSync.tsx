"use client"

import { useState } from 'react'
import { Badge, Button, Checkbox, Empty } from '@/components/ui'
import type { Account } from '@/lib/domain'
import { money } from '@/lib/format'
import { weekdayLabel } from '@/lib/schedule'
import type { FieldChange, TemplateChange } from '@/lib/template-sync'

const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${Number(value.slice(8))}-е` : 'любой день'

function fieldValue(field: FieldChange, value: FieldChange['before'], accounts: Account[]) {
  if (value === null || value === '') return '—'
  if (field.format === 'money') return money(Number(value) / 100)
  if (field.format === 'account') return accounts.find((account) => account.id === value)?.name ?? 'другой счёт'
  if (field.format === 'date') return date(String(value))
  if (field.format === 'schedule') return String(value).startsWith('weekly:') ? weekdayLabel(String(value).slice(7).split(',').map(Number)) : 'раз в месяц'
  return String(value)
}

export default function TemplateSync({ changes, accounts, onApply, onClose }: {
  changes: TemplateChange[]; accounts: Account[]
  onApply: (selected: TemplateChange[]) => void; onClose: () => void
}) {
  const [selected, setSelected] = useState(() => new Set(changes.map((change) => change.key)))
  const toggle = (key: string, on: boolean) => setSelected((current) => { const next = new Set(current); if (on) next.add(key); else next.delete(key); return next })
  const groups = [
    { title: 'Добавить', items: changes.filter((change) => change.type === 'add') },
    { title: 'Изменилось', items: changes.filter((change) => change.type === 'update') },
    { title: 'Убрать — больше не нужны', items: changes.filter((change) => change.type === 'remove') },
  ].filter((group) => group.items.length > 0)

  return <section className="card sync" aria-labelledby="sync-title">
    <header className="card-head"><div><h2 id="sync-title">Обновить из настроек</h2><p className="muted">Применится только отмеченное. Если сумму в месяце вы меняли сами — снимите галочку.</p></div></header>
    {changes.length === 0 && <Empty>Месяц совпадает с настройками.</Empty>}
    {groups.map((group) => <div className="sync-group" key={group.title}>
      <h3>{group.title}</h3>
      {group.items.map((change) => <div className="sync-item" key={change.key}>
        <Checkbox checked={selected.has(change.key)} onChange={(on) => toggle(change.key, on)}>
          <strong>{change.name}</strong> <span className="muted">{change.kind === 'income' ? 'доход' : 'платёж'}</span>
        </Checkbox>
        <div className="sync-detail">
          {change.type === 'add' && <span>{money(change.after.amount / 100)}</span>}
          {change.type === 'update' && change.fields.map((field) => <span key={field.label}>{field.label}: {fieldValue(field, field.before, accounts)} → <b>{fieldValue(field, field.after, accounts)}</b></span>)}
          {change.type !== 'add' && change.excluded && <Badge>не платим в этом месяце</Badge>}
        </div>
      </div>)}
    </div>)}
    <div className="card-actions">
      <Button onClick={onClose}>{changes.length ? 'Отмена' : 'Закрыть'}</Button>
      {changes.length > 0 && <Button variant="primary" disabled={selected.size === 0} onClick={() => onApply(changes.filter((change) => selected.has(change.key)))}>Применить · {selected.size}</Button>}
    </div>
  </section>
}
