"use client"

import { useState } from 'react'
import { Check } from 'lucide-react'
import { AddButton, Badge, Checkbox, DataTable, Empty, RowMenu, Segmented, type Column, type MenuItem } from '@/components/ui'
import { amountToCheck, type Account, type Income, type Plan } from '@/lib/domain'
import { money } from '@/lib/format'
import Amount from './Amount'
import Attention from './Attention'
import OneOffDialog from './OneOffDialog'
import Section from './Section'
import { beforeBalances, dayInPlan, dayText, incomeToCheck, isDate, periodOfPlan, incomeStatuses, total, type UpdatePlan } from './utils'

const statusOf = (income: Income) => income.enabled ? income.status : 'excluded'
const statusLabel = (status: string) => incomeStatuses.find((item) => item.value === status)?.label ?? status

export default function IncomesSection({ plan, readOnly, update, accountTag, accounts, onReset }: { plan: Plan; readOnly: boolean; update: UpdatePlan; accountTag: (id: string) => React.ReactNode; accounts: Account[]; onReset: (id: string) => void }) {
  const [adding, setAdding] = useState(false)
  const change = (id: string, patch: Partial<Income>) => update((current) => ({ ...current, incomes: current.incomes.map((income) => income.id === id ? { ...income, ...patch } : income) }))
  const remove = (id: string) => update((current) => ({ ...current, incomes: current.incomes.filter((income) => income.id !== id) }))
  const accountName = (id: string) => plan.accounts.find((account) => account.id === id)?.name ?? 'Счёт удалён'
  const expected = (items: Income[]) => items.filter((income) => income.enabled && income.status === 'expected')
  const period = periodOfPlan(plan)
  const isPast = (income: Income) => income.enabled && income.status === 'expected' && beforeBalances(period, income.expectedOn)
  const unchecked = plan.incomes.filter(incomeToCheck).length
  const done = plan.incomes.length > 0 && unchecked === 0
  const locked = (income: Income) => readOnly || Boolean(income.checked)

  const columns: Column<Income>[] = [
    { key: 'name', header: 'Доход', sort: (income) => income.name, mobile: 'title', cell: (income) => <span className="cell-name">
      <span className="cell-text">{income.name}</span>
      {!income.recurringIncomeId && <Badge>разовый</Badge>}
      <Attention notes={[
        ...(amountToCheck(income) && !income.checked ? [{ label: 'уточнить сумму', reason: 'Укажите точную сумму или подтвердите текущую' }] : []),
        ...(isPast(income) && !income.checked ? [{ label: 'уже получен?', reason: 'Дата раньше даты остатков. Доход может быть уже учтён' }] : []),
      ]} />
    </span> },
    { key: 'account', header: 'Счёт', sort: (income) => accountName(income.accountId), filter: { type: 'list', value: (income) => income.accountId, label: accountName }, cell: (income) => accountTag(income.accountId) },
    { key: 'when', header: 'Когда', sort: (income) => isDate(income.expectedOn) ? income.expectedOn : '9', cell: (income) => <span className="muted">{dayText(income.expectedOn)}</span> },
    { key: 'status', header: 'Статус', mobile: 'full', sort: (income) => incomeStatuses.findIndex((item) => item.value === statusOf(income)),
      filter: { type: 'list', value: statusOf, label: statusLabel },
      cell: (income) => locked(income)
        ? <Badge tone={statusOf(income) === 'excluded' ? 'neutral' : 'blue'}>{statusLabel(statusOf(income))}</Badge>
        : <Segmented size="sm" label={`Статус: ${income.name}`} value={statusOf(income)} options={incomeStatuses}
          onChange={(value) => change(income.id, { status: value, enabled: true, ...(value === 'included' ? { amountPending: false } : {}) })} /> },
    { key: 'amount', header: 'Сумма', align: 'right', mobile: 'amount', sort: (income) => income.amount, footer: (rows) => money(total(expected(rows))),
      cell: (income) => <Amount label={`Сумма: ${income.name}`} value={income.amount} readOnly={locked(income)} onChange={(amount) => change(income.id, { amount, amountPending: false })} /> },
    { key: 'checked', header: 'Проверено', align: 'center', mobile: 'end',
      filter: { type: 'list', value: (income) => statusOf(income) === 'excluded' ? 'Не будет' : income.checked ? 'Проверено' : 'Не проверено' },
      cell: (income) => statusOf(income) === 'excluded' ? null : readOnly
        ? income.checked && <Check size={16} className="checked-mark" aria-label="Проверено" />
        : <Checkbox checked={Boolean(income.checked)} label={`Проверено: ${income.name}`} onChange={(checked) => change(income.id, checked ? { checked, amountPending: false } : { checked })} /> },
    { key: 'actions', header: 'Действия', hideHeader: true, mobile: 'end', className: 'actions', cell: (income) => {
      if (readOnly) return null
      const menu: MenuItem[] = income.recurringIncomeId
        ? income.checked ? [] : [{ label: 'Как в настройках', onSelect: () => onReset(income.id) }]
        : [{ label: 'Удалить', danger: true, onSelect: () => remove(income.id) }]
      return <RowMenu label={`Действия: ${income.name}`} items={menu} />
    } },
  ]

  return <Section step={2} title="Доходы" done={done}
    total={plan.incomes.length > 0 && `Ожидается ${money(total(expected(plan.incomes)))}`} meta={unchecked > 0 && `не проверено ${unchecked}`}>
    <DataTable label="Доходы" rows={plan.incomes} rowKey={(income) => income.id} columns={columns}
      rowClassName={(income) => statusOf(income) === 'excluded' ? 'is-muted' : undefined}
      defaultSort={{ key: 'when', dir: 'asc' }} footerLabel="Ожидается"
      search={(income) => `${income.name} ${accountName(income.accountId)}`}
      actions={!readOnly && <AddButton onClick={() => setAdding(true)} />}
      empty={<Empty>Доходов нет. Регулярные доходы добавляются в настройках.</Empty>} />
    {adding && <OneOffDialog kind="income" plan={plan} accounts={accounts} categories={[]} onClose={() => setAdding(false)}
      onSave={({ name, amount, accountId, day }) => {
        update((current) => ({ ...current, incomes: [...current.incomes, { id: crypto.randomUUID(), name, amount, accountId, expectedOn: day ? dayInPlan(current, day) : '', enabled: true, status: 'expected' }] }))
        setAdding(false)
      }} />}
  </Section>
}
