"use client"

import { useState } from 'react'
import { Check } from 'lucide-react'
import { AddButton, Badge, Button, Checkbox, DataTable, Empty, RowMenu, type Column, type MenuItem } from '@/components/ui'
import { amountToCheck, type Account, type Income, type Plan } from '@/lib/domain'
import { amount as plainAmount, money } from '@/lib/format'
import Amount from './Amount'
import Attention from './Attention'
import OneOffDialog from './OneOffDialog'
import { progress } from './Progress'
import Section from './Section'
import { beforeBalances, dayInPlan, dayText, incomeToCheck, isDate, periodOfPlan, incomeStatuses, total, type UpdatePlan } from './utils'

const statusOf = (income: Income) => income.enabled ? income.status : 'excluded'
const statusLabel = (status: string) => incomeStatuses.find((item) => item.value === status)?.label ?? status

export default function IncomesSection({ plan, readOnly, update, accountTag, accounts, categories, onReset, open, onToggle, done }: {
  plan: Plan; readOnly: boolean; update: UpdatePlan; accountTag: (id: string) => React.ReactNode; accounts: Account[]
  categories: string[]; onReset: (id: string) => void; open: boolean; onToggle: () => void; done: boolean
}) {
  const [adding, setAdding] = useState(false)
  const change = (id: string, patch: Partial<Income>) => update((current) => ({ ...current, incomes: current.incomes.map((income) => income.id === id ? { ...income, ...patch } : income) }))
  const remove = (id: string) => update((current) => ({ ...current, incomes: current.incomes.filter((income) => income.id !== id) }))
  const accountName = (id: string) => plan.accounts.find((account) => account.id === id)?.name ?? 'Счёт удалён'
  const expected = (items: Income[]) => items.filter((income) => income.enabled && income.status === 'expected')
  const period = periodOfPlan(plan)
  const isPast = (income: Income) => income.enabled && income.status === 'expected' && beforeBalances(period, income.expectedOn)
  // Excluded incomes need no check, so they are not counted.
  const toCheck = plan.incomes.filter((income) => income.enabled && income.status !== 'excluded')
  const unchecked = plan.incomes.filter(incomeToCheck).length
  const locked = (income: Income) => readOnly || Boolean(income.checked)
  const confirmAll = () => update((current) => ({ ...current, incomes: current.incomes.map((income) => incomeToCheck(income) ? { ...income, checked: true, amountPending: false } : income) }))

  const columns: Column<Income>[] = [
    { key: 'name', header: 'Доход', sort: (income) => income.name, mobile: 'title', cell: (income) => <span className="cell-name">
      <span className="cell-text">{income.name}</span>
      {!income.recurringIncomeId && <Badge>Разовый</Badge>}
      <Attention notes={[
        ...(amountToCheck(income) && !income.checked ? [{ label: 'Уточнить сумму', reason: 'Укажите точную сумму или подтвердите текущую' }] : []),
        ...(isPast(income) && !income.checked ? [{ label: 'Уже получен?', reason: 'Дата раньше даты расчёта. Доход может быть уже на счёте' }] : []),
      ]} />
    </span> },
    { key: 'account', header: 'Счёт', sort: (income) => accountName(income.accountId), filter: { type: 'list', value: (income) => income.accountId, label: accountName }, cell: (income) => accountTag(income.accountId) },
    { key: 'when', header: 'Когда', sort: (income) => isDate(income.expectedOn) ? income.expectedOn : '9', cell: (income) => <span className="muted">{dayText(income.expectedOn)}</span> },
    // Nearly every income is simply expected, so the usual case shows nothing at all and the two others show a badge.
    // Changing the status is a rare act and lives in the row menu, instead of three buttons in every row.
    { key: 'status', header: 'Статус', sort: (income) => incomeStatuses.findIndex((item) => item.value === statusOf(income)),
      filter: { type: 'list', value: statusOf, label: statusLabel },
      cell: (income) => statusOf(income) === 'expected' ? null : <Badge tone={statusOf(income) === 'excluded' ? 'neutral' : 'blue'}>{statusLabel(statusOf(income))}</Badge> },
    { key: 'amount', header: 'Сумма', align: 'right', mobile: 'amount', sort: (income) => income.amount, footer: (rows) => money(total(expected(rows))),
      card: (income) => <strong className="amount">{plainAmount(income.amount)}</strong>,
      cell: (income) => <Amount label={`Сумма: ${income.name}`} value={income.amount} readOnly={locked(income)} plain locked={!readOnly && Boolean(income.checked)}
        onChange={(value) => change(income.id, { amount: value, amountPending: false })} /> },
    { key: 'check', header: 'Проверено', mobile: 'end', className: 'actions',
      filter: { type: 'list', value: (income) => statusOf(income) === 'excluded' ? 'Не будет' : income.checked ? 'Проверено' : 'Не проверено' },
      cell: (income) => {
        const excluded = statusOf(income) === 'excluded'
        if (readOnly) return !excluded && income.checked ? <Check size={16} className="checked-mark" aria-label="Проверено" /> : null
        // A checked row is closed: no amount, no status, no deleting. Take the tick off to change anything.
        const status = (value: Income['status'], label: string) => ({ label, onSelect: () => change(income.id, { status: value, enabled: true, ...(value === 'included' ? { amountPending: false } : {}) }) })
        const menu: MenuItem[] = locked(income) ? [] : [
          ...incomeStatuses.filter((item) => item.value !== statusOf(income)).map((item) => status(item.value, item.label)),
          ...(income.recurringIncomeId ? [{ label: 'Вернуть как в настройках', onSelect: () => onReset(income.id) }] : [{ label: 'Удалить', danger: true, onSelect: () => remove(income.id) }]),
        ]
        return <div className="cell-actions">
          {!excluded && <Checkbox checked={Boolean(income.checked)} label={`Проверено: ${income.name}`} onChange={(checked) => change(income.id, checked ? { checked, amountPending: false } : { checked })} />}
          <RowMenu label={`Действия: ${income.name}`} items={menu} />
        </div>
      } },
  ]

  return <Section step={2} title="Доходы" open={open} onToggle={onToggle} done={done}
    total={plan.incomes.length > 0 && `Ожидается ${money(total(expected(plan.incomes)))}`} meta={progress(toCheck.length - unchecked, toCheck.length)}
    action={!readOnly && unchecked > 1 && <Button size="sm" variant="ghost" onClick={confirmAll}>Проверить все</Button>}>
    <DataTable label="Доходы" rows={plan.incomes} rowKey={(income) => income.id} columns={columns} rowTitle={(income) => income.name}
      rowClassName={(income) => statusOf(income) === 'excluded' ? 'is-muted' : undefined}
      defaultSort={{ key: 'when', dir: 'asc' }} footerLabel="Ожидается"
      actions={!readOnly && <AddButton onClick={() => setAdding(true)} />}
      empty={<Empty>Доходов пока нет. Регулярные доходы добавляются в настройках.</Empty>} />
    {adding && <OneOffDialog kind="income" plan={plan} accounts={accounts} categories={categories} onClose={() => setAdding(false)}
      onSave={({ name, amount: value, accountId, day, category }) => {
        update((current) => ({ ...current, incomes: [...current.incomes, { id: crypto.randomUUID(), name, amount: value, accountId, expectedOn: day ? dayInPlan(current, day) : '', enabled: true, status: 'expected', category }] }))
        setAdding(false)
      }} />}
  </Section>
}
