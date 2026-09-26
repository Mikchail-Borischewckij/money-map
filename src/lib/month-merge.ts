import { countWeekdaysInPeriod, dayInPeriod, type Period } from './period'
import type { MoneyIncome, MoneyPayment } from '../server/money'

// Settings as they apply to one month: the version effective on its first day. Amounts are in grosz.
// `varies`: the amount changes month to month, so the month gets it as an estimate to check.
export type PaymentTemplate = { id: string; name: string; category: string; accountId: string; amount: number; day: number | null; schedule: 'monthly' | 'weekly'; weekdays: number[] | null; varies?: boolean }
export type IncomeTemplate = { id: string; name: string; accountId: string; amount: number; day: number | null; varies: boolean }

export const whenever = 'в течение месяца'

const sameDays = (a: number[] | null | undefined, b: number[] | null | undefined) => (a ?? []).join(',') === (b ?? []).join(',')

// What a payment looks like in this month straight from settings: weekly ones count the weekdays in the period.
export function paymentFromTemplate(period: Period, template: PaymentTemplate, id: string): MoneyPayment {
  const common = { id, recurringPaymentId: template.id, name: template.name, category: template.category, accountId: template.accountId, enabled: true, exclusionReason: '' }
  if (template.schedule === 'weekly' && template.weekdays) {
    const quantity = countWeekdaysInPeriod(period, template.weekdays)
    return { ...common, schedule: 'weekly', weekdays: template.weekdays, unitPrice: template.amount, quantity, amount: template.amount * quantity, due: whenever, amountPending: false }
  }
  return { ...common, schedule: 'monthly', weekdays: null, unitPrice: null, quantity: null, amount: template.amount, due: dayInPeriod(period, template.day) ?? whenever, amountPending: Boolean(template.varies) }
}

export function incomeFromTemplate(period: Period, template: IncomeTemplate, id: string): MoneyIncome {
  return { id, recurringIncomeId: template.id, name: template.name, amount: template.amount, accountId: template.accountId, expectedOn: dayInPeriod(period, template.day) ?? '', enabled: true, status: 'expected', amountPending: template.varies }
}

export type Merge<T> = { value: T; kept: string[] }

// An amount still taken from settings is an estimate to check while settings say it varies; one set in the month is not.
const pending = (varies: boolean, open: boolean, followsSettings: boolean, wasPending: boolean | undefined, variedBefore: boolean | undefined) =>
  varies && open && followsSettings && (Boolean(wasPending) || !variedBefore)

// Carries a settings change into the open month. A field follows settings only while the month still has the old
// settings value; a value changed in the month itself wins and is reported in `kept`. Exclusions and income status stay,
// and so does a checked amount.
// `beforePeriod` is the period the old values were computed for, when the period itself changed.
export function mergePayment(period: Period, row: MoneyPayment | null, before: PaymentTemplate | null, after: PaymentTemplate, newId: () => string = () => crypto.randomUUID(), beforePeriod: Period = period): Merge<MoneyPayment> {
  if (!row) return { value: paymentFromTemplate(period, after, newId()), kept: [] }
  const old = before ? paymentFromTemplate(beforePeriod, before, row.id) : null
  const next = paymentFromTemplate(period, after, row.id)
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
    if (row.checked && row.schedule === 'weekly' && row.amount !== unitPrice! * quantity!) {
      kept.push('сумма')
      return { value: { ...base, amountPending: false }, kept }
    }
    return { value: { ...base, schedule: 'weekly', weekdays: next.weekdays, unitPrice, quantity, amount: unitPrice! * quantity!, due: whenever, amountPending: false }, kept }
  }
  // A checked amount stays as it is, whatever settings say now.
  const amount = row.checked ? row.amount : row.schedule === 'weekly' ? next.amount : pick('amount', 'сумма')
  if (row.checked && amount !== next.amount && !kept.includes('сумма')) kept.push('сумма')
  const due = row.schedule === 'weekly' ? next.due : pick('due', 'дата')
  const amountPending = !row.checked && pending(Boolean(after.varies), true, !old || row.amount === old.amount, row.amountPending, before?.varies)
  return { value: { ...base, schedule: 'monthly', weekdays: null, unitPrice: null, quantity: null, amount, due, amountPending }, kept }
}

export function mergeIncome(period: Period, row: MoneyIncome | null, before: IncomeTemplate | null, after: IncomeTemplate, newId: () => string = () => crypto.randomUUID(), beforePeriod: Period = period): Merge<MoneyIncome> {
  if (!row) return { value: incomeFromTemplate(period, after, newId()), kept: [] }
  const old = before ? incomeFromTemplate(beforePeriod, before, row.id) : null
  const next = incomeFromTemplate(period, after, row.id)
  const kept: string[] = []
  const pick = <K extends keyof MoneyIncome>(key: K, label: string): MoneyIncome[K] => {
    if (!old || row[key] === old[key]) return next[key]
    if (row[key] !== next[key]) kept.push(label)
    return row[key]
  }
  const amount = row.checked ? row.amount : pick('amount', 'сумма')
  if (row.checked && amount !== next.amount) kept.push('сумма')
  const amountPending = !row.checked && pending(after.varies, row.status === 'expected', !old || row.amount === old.amount, row.amountPending, before?.varies)
  return { value: { ...row, recurringIncomeId: after.id, name: pick('name', 'название'), amount, accountId: pick('accountId', 'счёт'), expectedOn: pick('expectedOn', 'дата'), amountPending }, kept }
}
