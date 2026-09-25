import { countWeekdays } from './schedule'
import type { MoneyIncome, MoneyPayment } from '../server/money'

// Settings as they apply to one month: the version effective on its first day. Amounts are in grosz.
export type PaymentTemplate = { id: string; name: string; category: string; accountId: string; amount: number; day: number | null; schedule: 'monthly' | 'weekly'; weekdays: number[] | null }
export type IncomeTemplate = { id: string; name: string; accountId: string; amount: number; day: number | null }

const whenever = 'в течение месяца'

export function dayInMonth(month: string, day: number | null) {
  if (!day) return null
  const [year, number] = month.split('-').map(Number)
  return `${month}-${String(Math.min(day, new Date(Date.UTC(year, number, 0)).getUTCDate())).padStart(2, '0')}`
}

const sameDays = (a: number[] | null | undefined, b: number[] | null | undefined) => (a ?? []).join(',') === (b ?? []).join(',')

// What a payment looks like in this month straight from settings: weekly ones count the weekdays in the calendar.
export function paymentFromTemplate(month: string, template: PaymentTemplate, id: string): MoneyPayment {
  const common = { id, recurringPaymentId: template.id, name: template.name, category: template.category, accountId: template.accountId, enabled: true, exclusionReason: '' }
  if (template.schedule === 'weekly' && template.weekdays) {
    const quantity = countWeekdays(month, template.weekdays)
    return { ...common, schedule: 'weekly', weekdays: template.weekdays, unitPrice: template.amount, quantity, amount: template.amount * quantity, due: whenever }
  }
  return { ...common, schedule: 'monthly', weekdays: null, unitPrice: null, quantity: null, amount: template.amount, due: dayInMonth(month, template.day) ?? whenever }
}

export function incomeFromTemplate(month: string, template: IncomeTemplate, id: string): MoneyIncome {
  return { id, recurringIncomeId: template.id, name: template.name, amount: template.amount, accountId: template.accountId, expectedOn: dayInMonth(month, template.day) ?? '', enabled: true, status: 'expected' }
}

export type Merge<T> = { value: T; kept: string[] }

// Carries a settings change into the open month. A field follows settings only while the month still has the old
// settings value; a value changed in the month itself wins and is reported in `kept`. Exclusions and income status stay.
export function mergePayment(month: string, row: MoneyPayment | null, before: PaymentTemplate | null, after: PaymentTemplate, newId: () => string = () => crypto.randomUUID()): Merge<MoneyPayment> {
  if (!row) return { value: paymentFromTemplate(month, after, newId()), kept: [] }
  const old = before ? paymentFromTemplate(month, before, row.id) : null
  const next = paymentFromTemplate(month, after, row.id)
  const kept: string[] = []
  const pick = <K extends keyof MoneyPayment>(key: K, label: string): MoneyPayment[K] => {
    if (!old || row[key] === old[key]) return next[key]
    if (row[key] !== next[key]) kept.push(label)
    return row[key]
  }
  const base = { ...row, recurringPaymentId: after.id, name: pick('name', 'название'), category: pick('category', 'категория'), accountId: pick('accountId', 'счёт') }
  if (next.schedule === 'weekly') {
    // New weekdays mean a new count; otherwise a count corrected in the month stays.
    const quantity = row.schedule === 'weekly' && sameDays(row.weekdays, next.weekdays) ? pick('quantity', 'количество') : next.quantity
    const unitPrice = row.schedule === 'weekly' ? pick('unitPrice', 'цена за раз') : next.unitPrice
    return { value: { ...base, schedule: 'weekly', weekdays: next.weekdays, unitPrice, quantity, amount: unitPrice! * quantity!, due: whenever }, kept }
  }
  const amount = row.schedule === 'weekly' ? next.amount : pick('amount', 'сумма')
  const due = row.schedule === 'weekly' ? next.due : pick('due', 'дата')
  return { value: { ...base, schedule: 'monthly', weekdays: null, unitPrice: null, quantity: null, amount, due }, kept }
}

export function mergeIncome(month: string, row: MoneyIncome | null, before: IncomeTemplate | null, after: IncomeTemplate, newId: () => string = () => crypto.randomUUID()): Merge<MoneyIncome> {
  if (!row) return { value: incomeFromTemplate(month, after, newId()), kept: [] }
  const old = before ? incomeFromTemplate(month, before, row.id) : null
  const next = incomeFromTemplate(month, after, row.id)
  const kept: string[] = []
  const pick = <K extends keyof MoneyIncome>(key: K, label: string): MoneyIncome[K] => {
    if (!old || row[key] === old[key]) return next[key]
    if (row[key] !== next[key]) kept.push(label)
    return row[key]
  }
  return { value: { ...row, recurringIncomeId: after.id, name: pick('name', 'название'), amount: pick('amount', 'сумма'), accountId: pick('accountId', 'счёт'), expectedOn: pick('expectedOn', 'дата') }, kept }
}
