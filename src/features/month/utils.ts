import type { Account, Plan } from '@/lib/domain'
import { dayInPeriod, type Period } from '@/lib/period'

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

export const periodOfPlan = (plan: Plan): Period => ({ month: plan.month, startDay: plan.startDay ?? 1 })

// The date a chosen day of the month falls on in the plan's period.
export const dayInPlan = (plan: Plan, day: number) => dayInPeriod(periodOfPlan(plan), day)!

export const kindLabel: Record<Account['kind'], string> = { current: 'Текущий', savings: 'Накопительный', cash: 'Наличные', business: 'Бизнес' }

export const incomeStatuses = [
  { value: 'expected', label: 'Ожидается' },
  { value: 'included', label: 'Уже на счёте' },
  { value: 'excluded', label: 'Не будет' },
] as const

export const savingsOf = (plan: Plan) => plan.allocations.find((allocation) => allocation.kind === 'savings')
