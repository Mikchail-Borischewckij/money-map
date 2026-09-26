"use client"

import { useState } from 'react'
import { AccountBadge, AddButton, Badge, DataTable, Empty, RowMenu, type Column } from '@/components/ui'
import { toCents } from '@/lib/api-client'
import { money } from '@/lib/format'
import { weekdayLabel } from '@/lib/schedule'
import ArchiveTabs, { type ArchiveTab } from './ArchiveTabs'
import { send } from './api'
import TemplateDialog from './TemplateDialog'
import type { AccountRow, Category, Preview, Run, Template, TemplateForm, TemplateKind } from './types'

const scheduleText = (item: Template) => item.schedule === 'weekly' && item.weekdays ? weekdayLabel(item.weekdays) : item.day ? `${item.day}‑е число` : 'В любой день'
const formOf = (item: Template): TemplateForm => ({ name: item.name, amount: Number(item.default_amount) / 100, accountId: item.account_id, day: item.day, categoryId: item.category_id ?? '', schedule: item.schedule ?? 'monthly', weekdays: item.weekdays ?? [], amountVaries: item.amount_varies ?? false })

export default function TemplatesTab({ kind, items, accounts, categories, csrfToken, run }: { kind: TemplateKind; items: Template[]; accounts: AccountRow[]; categories: Category[]; csrfToken: string; run: Run }) {
  const [editing, setEditing] = useState<Template | 'new' | null>(null)
  const [tab, setTab] = useState<ArchiveTab>('active')
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
    categoryId: value.categoryId || null,
    ...(kind === 'payment' ? { schedule: value.schedule, weekdays: value.schedule === 'weekly' ? value.weekdays : null } : {}),
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
  const archivedTab = tab === 'archived'
  const lastMonth = (item: Template) => !ended(item) && item.active_to !== null
  const menu = (item: Template) => <RowMenu label={`Действия: ${item.name}`} items={ended(item) || lastMonth(item)
    ? [{ label: 'Снова нужен', onSelect: () => void run(() => send(`${url}/${item.id}`, 'PUT', csrfToken, payload(formOf(item), item.version, false)), 'Снова действует.', patchItem(item.id, { active_to: null, is_archived: false })) }]
    : [
      { label: 'Изменить', onSelect: () => setEditing(item) },
      { label: 'Больше не нужен', danger: true, onSelect: () => void run(() => send(`${url}/${item.id}`, 'PUT', csrfToken, payload(formOf(item), item.version, true)), 'Готово. В этом месяце остаётся, в следующие не попадёт.', patchItem(item.id, { active_to: today })) },
    ]} />
  const account = (item: Template) => {
    const source = accounts.find((candidate) => candidate.id === item.account_id)
    return <AccountBadge name={source?.name ?? ''} bank={source?.bank} />
  }

  const columns: Column<Template>[] = [
    { key: 'name', header: 'Название', sort: (item) => item.name, mobile: 'title', cell: (item) => <span className="cell-name">
      <span className="cell-text">{item.name}</span>{lastMonth(item) && <Badge tone="warn">последний месяц</Badge>}{item.amount_varies && <Badge>сумма меняется</Badge>}
    </span> },
    { key: 'when', header: 'Когда', sort: (item) => item.day ?? (item.schedule === 'weekly' ? 0 : 99), cell: scheduleText },
    { key: 'account', header: 'Счёт', sort: (item) => accountName(item.account_id), filter: { type: 'list', value: (item) => item.account_id, label: accountName }, cell: account },
    { key: 'category', header: 'Категория', sort: (item) => categoryName(item.category_id) || 'я', filter: { type: 'list', value: (item) => categoryName(item.category_id) },
      cell: (item) => categoryName(item.category_id) || <span className="muted">Не указана</span> },
    { key: 'amount', header: 'Сумма', align: 'right', mobile: 'amount', sort: (item) => Number(item.default_amount),
      cell: (item) => <>{money(Number(item.default_amount) / 100)}{item.schedule === 'weekly' && <small> за раз</small>}</> },
    { key: 'actions', header: 'Действия', hideHeader: true, mobile: 'end', className: 'actions', cell: menu },
  ]

  const save = (value: TemplateForm) => {
    const target = editing === 'new' ? null : editing
    setEditing(null)
    void run(() => target ? send(`${url}/${target.id}`, 'PUT', csrfToken, payload(value, target.version)) : send(url, 'POST', csrfToken, payload(value)), target ? 'Сохранено.' : 'Добавлено.',
      target ? patchItem(target.id, asTemplate(value, target)) : preview((items) => [...items, asTemplate(value, {})]))
  }

  return <section className="card">
    <header className="card-head"><div><h2>{payments ? 'Регулярные платежи' : 'Регулярные доходы'}</h2><p className="muted">Действуют с открытого месяца. Закрытые месяцы не меняются.</p></div>
      <ArchiveTabs value={tab} onChange={setTab} archived={past.length} /></header>
    {noAccounts && !archivedTab && <Empty>Сначала добавьте счёт.</Empty>}
    <DataTable key={tab} label={payments ? 'Регулярные платежи' : 'Регулярные доходы'} rows={archivedTab ? past : current} rowKey={(item) => item.id} columns={columns}
      rowClassName={archivedTab ? () => 'is-muted' : undefined} defaultSort={{ key: 'when', dir: 'asc' }}
      search={(item) => `${item.name} ${accountName(item.account_id)} ${categoryName(item.category_id)}`}
      actions={!archivedTab && <AddButton disabled={noAccounts} onClick={() => setEditing('new')} />}
      empty={!noAccounts && <Empty>{archivedTab ? 'В архиве пусто.' : 'Пока пусто.'}</Empty>} />
    {editing && <TemplateDialog kind={kind} value={editing === 'new' ? null : formOf(editing)}
      accounts={accounts.filter((account) => !account.is_archived || (editing !== 'new' && account.id === editing.account_id))}
      categories={categories.filter((category) => !category.is_archived)} onClose={() => setEditing(null)} onSave={save} />}
  </section>
}
