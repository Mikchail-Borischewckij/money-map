"use client"

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge, Button, Empty, RowMenu, Segmented, type MenuItem } from '@/components/ui'
import { amountToCheck, type Account, type Income, type Plan } from '@/lib/domain'
import { cx, money } from '@/lib/format'
import Amount from './Amount'
import OneOffDialog from './OneOffDialog'
import Section from './Section'
import { beforeBalances, dayInPlan, dayText, periodOfPlan, incomeStatuses, total, type UpdatePlan } from './utils'

export default function IncomesSection({ plan, readOnly, update, accountTag, accounts, onReset }: { plan: Plan; readOnly: boolean; update: UpdatePlan; accountTag: (id: string) => React.ReactNode; accounts: Account[]; onReset: (id: string) => void }) {
  const [adding, setAdding] = useState(false)
  const change = (id: string, patch: Partial<Income>) => update((current) => ({ ...current, incomes: current.incomes.map((income) => income.id === id ? { ...income, ...patch } : income) }))
  const remove = (id: string) => update((current) => ({ ...current, incomes: current.incomes.filter((income) => income.id !== id) }))
  const expected = plan.incomes.filter((income) => income.enabled && income.status === 'expected')
  const toCheck = plan.incomes.filter(amountToCheck).length
  return <Section step={2} title="Доходы"
    meta={plan.incomes.length > 0 && <span>Ожидается {money(total(expected))}</span>}
    action={!readOnly && <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Разовый доход</Button>}>
    {plan.incomes.length === 0 && <Empty>Доходов нет. Регулярные доходы добавляются в настройках.</Empty>}
    <div className="rows">
      {plan.incomes.map((income) => {
        const status = income.enabled ? income.status : 'excluded'
        const past = status === 'expected' && beforeBalances(periodOfPlan(plan), income.expectedOn)
        const menu: MenuItem[] = readOnly ? [] : income.recurringIncomeId
          ? [{ label: 'Как в настройках', onSelect: () => onReset(income.id) }]
          : [{ label: 'Удалить', danger: true, onSelect: () => remove(income.id) }]
        return <div className={cx('row', status === 'excluded' && 'is-muted')} key={income.id}>
          <div className="row-main">
            <strong>{income.name}{!income.recurringIncomeId && <Badge>разовый</Badge>}{amountToCheck(income) && <Badge tone="warn">уточните сумму</Badge>}{past && <Badge tone="warn">дата прошла</Badge>}</strong>
            <span className="row-meta row-tags">{accountTag(income.accountId)}{dayText(income.expectedOn) && <span>{dayText(income.expectedOn)}</span>}</span>
          </div>
          <div className="row-side row-side-wrap">
            {readOnly ? <Badge tone={status === 'excluded' ? 'neutral' : 'blue'}>{incomeStatuses.find((item) => item.value === status)?.label}</Badge>
              : <Segmented size="sm" label={`Статус: ${income.name}`} value={status} options={incomeStatuses} onChange={(value) => change(income.id, { status: value, enabled: true, ...(value === 'included' ? { amountPending: false } : {}) })} />}
            <Amount label={`Сумма: ${income.name}`} value={income.amount} readOnly={readOnly} onChange={(amount) => change(income.id, { amount, amountPending: false })} />
            {!readOnly && amountToCheck(income) && <Button size="sm" variant="ghost" onClick={() => change(income.id, { amountPending: false })}>Сумма верна</Button>}
            {!readOnly && past && <Button size="sm" variant="ghost" onClick={() => change(income.id, { status: 'included', amountPending: false })}>Уже на счёте</Button>}
            <RowMenu label={`Действия: ${income.name}`} items={menu} />
          </div>
        </div>
      })}
    </div>
    {toCheck > 0 && <p className="note">Сумма меняется от месяца к месяцу — сейчас стоит оценка из настроек. Впишите точную или нажмите «Сумма верна».</p>}
    {plan.incomes.some((income) => income.status === 'included' && income.enabled) && <p className="note">«Уже на счёте» — деньги уже входят в остаток и второй раз не считаются.</p>}
    {adding && <OneOffDialog kind="income" plan={plan} accounts={accounts} categories={[]} onClose={() => setAdding(false)}
      onSave={({ name, amount, accountId, day }) => {
        update((current) => ({ ...current, incomes: [...current.incomes, { id: crypto.randomUUID(), name, amount, accountId, expectedOn: day ? dayInPlan(current, day) : '', enabled: true, status: 'expected' }] }))
        setAdding(false)
      }} />}
  </Section>
}
