import type { Account, Plan } from '@/lib/domain'

export type UpdatePlan = (change: (plan: Plan) => Plan) => void

export type MonthActions = {
  onResetPayment: (id: string) => void
  onResetIncome: (id: string) => void
  onOpenSettings: () => void
}

export const round = (value: number) => Math.round(value * 100) / 100
export const total = (items: { amount: number }[]) => round(items.reduce((sum, item) => sum + item.amount, 0))
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
export const dayText = (value: string) => isDate(value) ? `${Number(value.slice(8))}-е` : ''

export function dayInMonth(month: string, day: number) {
  const [year, number] = month.split('-').map(Number)
  return `${month}-${String(Math.min(day, new Date(Date.UTC(year, number, 0)).getUTCDate())).padStart(2, '0')}`
}

export const kindLabel: Record<Account['kind'], string> = { current: 'Текущий', savings: 'Накопительный', cash: 'Наличные' }

export const incomeStatuses = [
  { value: 'expected', label: 'Ожидается' },
  { value: 'included', label: 'Уже на счёте' },
  { value: 'excluded', label: 'Не будет' },
] as const
