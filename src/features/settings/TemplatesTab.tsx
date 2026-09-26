"use client"

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AccountBadge, Badge, Button, Empty, Pagination, RowMenu, TableToolbar } from '@/components/ui'
import { toCents } from '@/lib/api-client'
import { money } from '@/lib/format'
import { weekdayLabel } from '@/lib/schedule'
import { pageRows } from '@/lib/table'
import { send } from './api'
import TemplateDialog from './TemplateDialog'
import type { AccountRow, Category, Preview, Run, Template, TemplateForm, TemplateKind } from './types'

const scheduleText = (item: Template) => item.schedule === 'weekly' && item.weekdays ? weekdayLabel(item.weekdays) : item.day ? `${item.day}‑е число` : 'В любой день'
const formOf = (item: Template): TemplateForm => ({ name: item.name, amount: Number(item.default_amount) / 100, accountId: item.account_id, day: item.day, categoryId: item.category_id ?? '', schedule: item.schedule ?? 'monthly', weekdays: item.weekdays ?? [], amountVaries: item.amount_varies ?? false })

export default function TemplatesTab({ kind, items, accounts, categories, csrfToken, run }: { kind: TemplateKind; items: Template[]; accounts: AccountRow[]; categories: Category[]; csrfToken: string; run: Run }) {
  const [editing, setEditing] = useState<Template | 'new' | null>(null)
  const [showEnded, setShowEnded] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'name' | 'amount' | 'date'>('date')
  const [page, setPage] = useState(1)
  const today = new Date().toISOString().slice(0, 10)
  const ended = (item: Template) => item.is_archived || (item.active_to !== null && item.active_to < today)
  const current = items.filter((item) => !ended(item))
  const past = items.filter(ended)
  const noAccounts = accounts.every((account) => account.is_archived)
  const url = `/api/recurring-${kind === 'income' ? 'incomes' : 'payments'}`
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? ''
  const categoryName = (id?: string | null) => categories.find((category) => category.id === id)?.name ?? ''
  const filtered = current
    .filter((item) => `${item.name} ${accountName(item.account_id)} ${categoryName(item.category_id)}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ru')
      : sort === 'amount' ? Number(b.default_amount) - Number(a.default_amount)
        : (a.day ?? 99) - (b.day ?? 99) || a.name.localeCompare(b.name, 'ru'))
  const paged = pageRows(filtered, page, 8)
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
  const account = (item: Template) => {
    const source = accounts.find((candidate) => candidate.id === item.account_id)
    return <AccountBadge name={source?.name ?? ''} bank={source?.bank} />
  }

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
        {payments && <td className="col-opt">{category || <span className="muted">Не указана</span>}</td>}
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
    </header>
    <TableToolbar query={query} onQueryChange={(value) => { setQuery(value); setPage(1) }} sort={sort} onSortChange={(value) => { setSort(value); setPage(1) }} sortOptions={[
      { value: 'date', label: 'По дате' }, { value: 'name', label: 'По названию' }, { value: 'amount', label: 'По сумме' },
    ]}><Button variant="primary" icon={<Plus size={16} />} disabled={noAccounts} onClick={() => setEditing('new')}>Добавить {kind === 'payment' ? 'платёж' : 'доход'}</Button></TableToolbar>
    {noAccounts && <Empty>Сначала добавьте счёт.</Empty>}
    {current.length === 0 && !noAccounts && <Empty>Пока пусто.</Empty>}
    {current.length > 0 && filtered.length === 0 && <Empty>Ничего не найдено.</Empty>}
    {paged.rows.length > 0 && table(paged.rows, false)}
    <Pagination page={paged.page} pages={paged.pages} total={filtered.length} onChange={setPage} />
    {past.length > 0 && <button type="button" className="link archived-toggle" onClick={() => setShowEnded(!showEnded)}>{showEnded ? 'Скрыть' : `Больше не нужны · ${past.length}`}</button>}
    {showEnded && table(past, true)}
    {editing && <TemplateDialog kind={kind} value={editing === 'new' ? null : formOf(editing)}
      accounts={accounts.filter((account) => !account.is_archived || (editing !== 'new' && account.id === editing.account_id))}
      categories={categories.filter((category) => !category.is_archived)} onClose={() => setEditing(null)} onSave={save} />}
  </section>
}
