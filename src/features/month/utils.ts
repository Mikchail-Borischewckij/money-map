import type { Account, Plan } from '@/lib/domain'
import { countFrom, countWeekdaysInPeriod, dayInPeriod, periodEnd, periodStart, type Period } from '@/lib/period'

export type UpdatePlan = (change: (plan: Plan) => Plan) => void

export type MonthActions = {
  onResetPayment: (id: string) => void
  onResetIncome: (id: string) => void
  onOpenSettings: () => void
}

export const round = (value: number) => Math.round(value * 100) / 100
export const total = (items: { amount: number }[]) => round(items.reduce((sum, item) => sum + item.amount, 0))
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
export const dayText = (value: string) => isDate(value) ? `${Number(value.slice(8))}‑е` : ''

export const periodOfPlan = (plan: Plan): Period => ({ month: plan.month, startDay: plan.startDay ?? 1, from: plan.balancesOn ?? null })

const pad = (value: number) => String(value).padStart(2, '0')
const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` }

// Today, kept inside the plan's period.
export function todayInPlan(plan: Plan) {
  const period = periodOfPlan(plan)
  const today = localToday()
  return today < periodStart(period) ? periodStart(period) : today > periodEnd(period) ? periodEnd(period) : today
}

// A new balances date recounts weekly payments that still follow the calendar; counts changed by hand stay.
export function withBalancesDate(plan: Plan, balancesOn: string): Plan {
  const before = periodOfPlan(plan)
  const after = { ...before, from: balancesOn }
  return { ...plan, balancesOn, payments: plan.payments.map((payment) => {
    if (payment.checked || payment.unitPrice == null || payment.quantity == null || !payment.weekdays || payment.quantity !== countWeekdaysInPeriod(before, payment.weekdays)) return payment
    const quantity = countWeekdaysInPeriod(after, payment.weekdays)
    return { ...payment, quantity, amount: round(payment.unitPrice * quantity) }
  }) }
}

// Until any balance is checked, the open month is counted from today: the balances are about to be entered.
export function countFromToday(plan: Plan): Plan {
  if (plan.accounts.some((account) => account.balanceConfirmed)) return plan
  const today = todayInPlan(plan)
  return plan.balancesOn === today ? plan : withBalancesDate(plan, today)
}

// Before the balances date: already in the balances, so a still planned payment or income there is probably paid or received.
export const beforeBalances = (period: Period, date: string) => isDate(date) && date < countFrom(period)

// The date a chosen day of the month falls on in the plan's period.
export const dayInPlan = (plan: Plan, day: number) => dayInPeriod(periodOfPlan(plan), day)!

export const kindLabel: Record<Account['kind'], string> = { current: 'Текущий', savings: 'Накопительный', cash: 'Наличные', business: 'Бизнес' }

export const incomeStatuses = [
  { value: 'expected', label: 'Ожидается' },
  { value: 'included', label: 'Уже на счёте' },
  { value: 'excluded', label: 'Не будет' },
] as const

export const savingsOf = (plan: Plan) => plan.allocations.find((allocation) => allocation.kind === 'savings')
