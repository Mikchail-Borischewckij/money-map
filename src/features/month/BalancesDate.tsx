import { Select } from '@/components/ui'
import type { Plan } from '@/lib/domain'
import { dayLabel } from '@/lib/format'
import { periodDays } from '@/lib/period'
import { periodOfPlan, todayInPlan, withBalancesDate, type UpdatePlan } from './utils'

// The date the month is counted from: balances are as of this day, and earlier payments and incomes are already in them.
export default function BalancesDate({ plan, readOnly, update }: { plan: Plan; readOnly: boolean; update: UpdatePlan }) {
  const date = plan.balancesOn ?? todayInPlan(plan)
  if (readOnly) return <span className="balances-date">Расчёт на {dayLabel(date)}</span>
  const options = periodDays(periodOfPlan(plan)).map((day) => ({ value: day, label: dayLabel(day) }))
  return <div className="balances-date"><span>Расчёт на</span>
    <Select compact label="Дата расчёта" value={date} options={options} onChange={(value) => update((current) => withBalancesDate(current, value))} />
  </div>
}
