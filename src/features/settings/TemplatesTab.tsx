"use client"

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AccountBadge, Badge, Button, Empty, RowMenu } from '@/components/ui'
import { accountHue } from '@/lib/account-color'
import { toCents } from '@/lib/api-client'
import { money } from '@/lib/format'
import { weekdayLabel } from '@/lib/schedule'
import { send } from './api'
import TemplateDialog from './TemplateDialog'
import type { AccountRow, Category, Preview, Run, Template, TemplateForm, TemplateKind } from './types'

const scheduleText = (item: Template) => item.schedule === 'weekly' && item.weekdays ? weekdayLabel(item.weekdays) : item.day ? `${item.day}‑е число` : 'В любой день'
const formOf = (item: Template): TemplateForm => ({ name: item.name, amount: Number(item.default_amount) / 100, accountId: item.account_id, day: item.day, categoryId: item.category_id ?? '', schedule: item.schedule ?? 'monthly', weekdays: item.weekdays ?? [], amountVaries: item.amount_varies ?? false })

export default function TemplatesTab({ kind, items, accounts, categories, csrfToken, run }: { kind: TemplateKind; items: Template[]; accounts: AccountRow[]; categories: Category[]; csrfToken: string; run: Run }) {
  const [editing, setEditing] = useState<Template | 'new' | null>(null)
  const [showEnded, setShowEnded] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const ended = (item: Template) => item.is_archived || (item.active_to !== null && item.active_to < today)
  const current = items.filter((item) => !ended(item))
  const past = items.filter(ended)
  const noAccounts = accounts.every((account) => account.is_archived)
  const url = `/api/recurring-${kind === 'income' ? 'incomes' : 'payments'}`
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? ''
  const categoryName = (id?: string | null) => categories.find((category) => category.id === id)?.name ?? ''
  const payload = (value: TemplateForm, version?: number, endedFlag = false) => ({
    name: value.name, defaultAmount: toCents(value.amount), accountId: value.accountId,
    day: value.schedule === 'weekly' ? null : value.day, version, ended: endedFlag,
    ...(kind === 'payment' ? { categoryId: value.categoryId || null, schedule: value.schedule, weekdays: value.schedule === 'weekly' ? value.weekdays : null } : {}),
    amountVaries: value.schedule !== 'weekly' && value.amountVaries,
  })

  const list = kind === 'income' ? 'incomes' : 'payments'
  const asTemplate = (value: TemplateForm, base: Partial<Template>): Template => ({
    id: `new-${crypto.randomUUID()}`, active_to: null, is_archived: false, version: 0, ...base,
    name: value.name, default_amount: String(toCents(value.amount)), account_id: value.accountId, day: value.schedule === 'weekly' ? null : value.day,
    category_id: value.categoryId || null, schedule: value.schedule, weekdays: value.schedule === 'weekly' ? value.weekdays : null, amount_varies: value.amountVaries,
  })
  const preview = (change: (items: Template[]) => Template[]): Preview => (lists) => ({ ...lists, [list]: change(lists[list]) })
  const patchItem = (id: string, patch: Partial<Template>) => preview((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))

  const payments = kind === 'payment'
  const menu = (item: Template, isPast: boolean, lastMonth: boolean) => <RowMenu label={`Действия: ${item.name}`} items={isPast || lastMonth
    ? [{ label: 'Снова нужен', onSelect: () => void run(() => send(`${url}/${item.id}`, 'PUT', csrfToken, payload(formOf(item), item.version, false)), 'Снова действует.', patchItem(item.id, { active_to: null, is_archived: false })) }]
    : [
      { label: 'Изменить', onSelect: () => setEditing(item) },
      { label: 'Больше не нужен', danger: true, onSelect: () => void run(() => send(`${url}/${item.id}`, 'PUT', csrfToken, payload(formOf(item), item.version, true)), 'Готово. В этом месяце остаётся, в следующие не попадёт.', patchItem(item.id, { active_to: today })) },
    ]} />
  const account = (item: Template) => <AccountBadge name={accountName(item.account_id)} hue={accountHue(accounts, item.account_id)} />

  const table = (rows: Template[], isPast: boolean) => <div className="table-scroll"><table className="data-table">
    <thead><tr>
      <th>Название</th><th className="col-opt">Когда</th><th className="col-opt">Счёт</th>{payments && <th className="col-opt">Категория</th>}<th className="num">Сумма</th><th className="actions"><span className="sr-only">Действия</span></th>
    </tr></thead>
    <tbody>{rows.map((item) => {
      const amount = Number(item.default_amount) / 100
      const lastMonth = !isPast && item.active_to !== null
      const category = payments ? categoryName(item.category_id) : ''
      return <tr key={item.id} className={isPast ? 'is-muted' : undefined}>
        <td>
          <div className="cell-name">{item.name}{lastMonth && <Badge tone="warn">последний месяц</Badge>}{item.amount_varies && <Badge>сумма меняется</Badge>}</div>
          <div className="cell-sub">{account(item)}<span>{[scheduleText(item), category].filter(Boolean).join(' · ')}</span></div>
        </td>
        <td className="col-opt">{scheduleText(item)}</td>
        <td className="col-opt">{account(item)}</td>
        {payments && <td className="col-opt">{category || <span className="muted">—</span>}</td>}
        <td className="num">{money(amount)}{item.schedule === 'weekly' && <small> за раз</small>}</td>
        <td className="actions">{menu(item, isPast, lastMonth)}</td>
      </tr>
    })}</tbody>
  </table></div>

  const save = (value: TemplateForm) => {
    const target = editing === 'new' ? null : editing
    setEditing(null)
    void run(() => target ? send(`${url}/${target.id}`, 'PUT', csrfToken, payload(value, target.version)) : send(url, 'POST', csrfToken, payload(value)), target ? 'Сохранено.' : 'Добавлено.',
      target ? patchItem(target.id, asTemplate(value, target)) : preview((items) => [...items, asTemplate(value, {})]))
  }

  return <section className="card">
    <header className="card-head"><div><h2>{kind === 'payment' ? 'Регулярные платежи' : 'Регулярные доходы'}</h2><p className="muted">Действуют с открытого месяца. Закрытые месяцы не меняются.</p></div>
      <Button variant="primary" icon={<Plus size={16} />} disabled={noAccounts} onClick={() => setEditing('new')}>{kind === 'payment' ? 'Платёж' : 'Доход'}</Button></header>
    {noAccounts && <Empty>Сначала добавьте счёт.</Empty>}
    {current.length === 0 && !noAccounts && <Empty>Пока пусто.</Empty>}
    {current.length > 0 && table(current, false)}
    {past.length > 0 && <button type="button" className="link archived-toggle" onClick={() => setShowEnded(!showEnded)}>{showEnded ? 'Скрыть' : `Больше не нужны · ${past.length}`}</button>}
    {showEnded && table(past, true)}
    {editing && <TemplateDialog kind={kind} value={editing === 'new' ? null : formOf(editing)}
      accounts={accounts.filter((account) => !account.is_archived || (editing !== 'new' && account.id === editing.account_id))}
      categories={categories.filter((category) => !category.is_archived)} onClose={() => setEditing(null)} onSave={save} />}
  </section>
}
