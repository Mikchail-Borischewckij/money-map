"use client"

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge, Button, Empty, RowMenu, Segmented, type MenuItem } from '@/components/ui'
import { amountToCheck, type Account, type Income, type Plan } from '@/lib/domain'
import { cx, money } from '@/lib/format'
import Amount from './Amount'
import Attention from './Attention'
import OneOffDialog from './OneOffDialog'
import Section from './Section'
import { beforeBalances, dayInPlan, dayText, periodOfPlan, incomeStatuses, total, type UpdatePlan } from './utils'

export default function IncomesSection({ plan, readOnly, update, accountTag, accounts, onReset }: { plan: Plan; readOnly: boolean; update: UpdatePlan; accountTag: (id: string) => React.ReactNode; accounts: Account[]; onReset: (id: string) => void }) {
  const [adding, setAdding] = useState(false)
  const change = (id: string, patch: Partial<Income>) => update((current) => ({ ...current, incomes: current.incomes.map((income) => income.id === id ? { ...income, ...patch } : income) }))
  const remove = (id: string) => update((current) => ({ ...current, incomes: current.incomes.filter((income) => income.id !== id) }))
  const expected = plan.incomes.filter((income) => income.enabled && income.status === 'expected')
  const period = periodOfPlan(plan)
  const isPast = (income: Income) => income.enabled && income.status === 'expected' && beforeBalances(period, income.expectedOn)
  // Nothing to look at: no estimate to confirm and no expected income dated before the balances.
  const done = plan.incomes.length > 0 && !plan.incomes.some((income) => amountToCheck(income) || isPast(income))
  return <Section step={2} title="Доходы" done={done}
    meta={plan.incomes.length > 0 && <span>Ожидается {money(total(expected))}</span>}
    action={!readOnly && <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Разовый доход</Button>}>
    {plan.incomes.length === 0 && <Empty>Доходов нет. Регулярные доходы добавляются в настройках.</Empty>}
    <div className="rows">
      {plan.incomes.map((income) => {
        const status = income.enabled ? income.status : 'excluded'
        const past = isPast(income)
        const estimate = amountToCheck(income)
        const menu: MenuItem[] = readOnly ? [] : [
          ...(estimate ? [{ label: 'Сумма верна', onSelect: () => change(income.id, { amountPending: false }) }] : []),
          ...(income.recurringIncomeId ? [{ label: 'Как в настройках', onSelect: () => onReset(income.id) }] : [{ label: 'Удалить', danger: true, onSelect: () => remove(income.id) }]),
        ]
        return <div className={cx('row', status === 'excluded' && 'is-muted')} key={income.id}>
          <div className="row-main">
            <strong>{income.name}<Attention reasons={[...(estimate ? ['Укажите точную сумму или подтвердите текущую'] : []), ...(past ? ['Дата раньше даты остатков. Доход может быть уже учтён'] : [])]} /></strong>
            <span className="row-meta row-tags">{accountTag(income.accountId)}{dayText(income.expectedOn) && <span>{dayText(income.expectedOn)}</span>}{!income.recurringIncomeId && <span>разовый</span>}</span>
          </div>
          <div className="row-side row-side-wrap">
            {readOnly ? <Badge tone={status === 'excluded' ? 'neutral' : 'blue'}>{incomeStatuses.find((item) => item.value === status)?.label}</Badge>
              : <Segmented size="sm" label={`Статус: ${income.name}`} value={status} options={incomeStatuses} onChange={(value) => change(income.id, { status: value, enabled: true, ...(value === 'included' ? { amountPending: false } : {}) })} />}
            <Amount label={`Сумма: ${income.name}`} value={income.amount} readOnly={readOnly} onChange={(amount) => change(income.id, { amount, amountPending: false })} />
            <RowMenu label={`Действия: ${income.name}`} items={menu} />
          </div>
        </div>
      })}
    </div>
    {adding && <OneOffDialog kind="income" plan={plan} accounts={accounts} categories={[]} onClose={() => setAdding(false)}
      onSave={({ name, amount, accountId, day }) => {
        update((current) => ({ ...current, incomes: [...current.incomes, { id: crypto.randomUUID(), name, amount, accountId, expectedOn: day ? dayInPlan(current, day) : '', enabled: true, status: 'expected' }] }))
        setAdding(false)
      }} />}
  </Section>
}
