import { countWeekdays } from '../schedule'
import type { MoneyIncome, MoneyPayment } from './money'

// Templates as they apply to one month: the version effective on its first day. Amounts are in grosz.
export type PaymentTemplate = { id: string; name: string; category: string; accountId: string; amount: number; day: number | null; schedule: 'monthly' | 'weekly'; weekdays: number[] | null }
export type IncomeTemplate = { id: string; name: string; accountId: string; amount: number; day: number | null }

export type FieldFormat = 'text' | 'money' | 'account' | 'date' | 'schedule' | 'count'
export type FieldChange = { label: string; format: FieldFormat; before: string | number | null; after: string | number | null }

export type TemplateChange =
  | { kind: 'payment'; type: 'add'; key: string; name: string; after: MoneyPayment }
  | { kind: 'payment'; type: 'update'; key: string; name: string; fields: FieldChange[]; excluded: boolean; after: MoneyPayment }
  | { kind: 'payment'; type: 'remove'; key: string; name: string; excluded: boolean; id: string }
  | { kind: 'income'; type: 'add'; key: string; name: string; after: MoneyIncome }
  | { kind: 'income'; type: 'update'; key: string; name: string; fields: FieldChange[]; excluded: boolean; after: MoneyIncome }
  | { kind: 'income'; type: 'remove'; key: string; name: string; excluded: boolean; id: string }

const whenever = 'в течение месяца'

export function dayInMonth(month: string, day: number | null) {
  if (!day) return null
  const [year, number] = month.split('-').map(Number)
  return `${month}-${String(Math.min(day, new Date(Date.UTC(year, number, 0)).getUTCDate())).padStart(2, '0')}`
}

const scheduleText = (schedule: string | null | undefined, weekdays: number[] | null | undefined) => schedule === 'weekly' && weekdays?.length ? `weekly:${weekdays.join(',')}` : 'monthly'

// The values a template gives a payment in this month. Weekly payments keep a manually corrected count unless the weekdays change.
function paymentFromTemplate(month: string, template: PaymentTemplate, base: { id: string; enabled: boolean; exclusionReason?: string; quantity?: number | null; weekdays?: number[] | null }): MoneyPayment {
  const common = { id: base.id, recurringPaymentId: template.id, name: template.name, category: template.category, accountId: template.accountId, enabled: base.enabled, exclusionReason: base.enabled ? '' : base.exclusionReason ?? '' }
  if (template.schedule === 'weekly' && template.weekdays) {
    const sameDays = base.quantity != null && scheduleText('weekly', base.weekdays) === scheduleText('weekly', template.weekdays)
    const quantity = sameDays ? base.quantity! : countWeekdays(month, template.weekdays)
    return { ...common, schedule: 'weekly', weekdays: template.weekdays, unitPrice: template.amount, quantity, amount: template.amount * quantity, due: whenever }
  }
  return { ...common, schedule: 'monthly', weekdays: null, unitPrice: null, quantity: null, amount: template.amount, due: dayInMonth(month, template.day) ?? whenever }
}

function paymentFields(before: MoneyPayment, after: MoneyPayment): FieldChange[] {
  const fields: FieldChange[] = []
  const push = (label: string, format: FieldFormat, a: string | number | null, b: string | number | null) => { if (a !== b) fields.push({ label, format, before: a, after: b }) }
  push('Название', 'text', before.name, after.name)
  push('Категория', 'text', before.category, after.category)
  push('Как часто', 'schedule', scheduleText(before.schedule, before.weekdays), scheduleText(after.schedule, after.weekdays))
  if (after.unitPrice != null) {
    push('Цена за раз', 'money', before.unitPrice ?? null, after.unitPrice)
    push('Сколько раз', 'count', before.quantity ?? null, after.quantity ?? null)
  }
  push('Сумма', 'money', before.amount, after.amount)
  push('Счёт', 'account', before.accountId, after.accountId)
  push('Дата', 'date', before.due, after.due)
  return fields
}

function incomeFields(before: MoneyIncome, after: MoneyIncome): FieldChange[] {
  const fields: FieldChange[] = []
  const push = (label: string, format: FieldFormat, a: string | number | null, b: string | number | null) => { if (a !== b) fields.push({ label, format, before: a, after: b }) }
  push('Название', 'text', before.name, after.name)
  push('Сумма', 'money', before.amount, after.amount)
  push('Счёт', 'account', before.accountId, after.accountId)
  push('Дата', 'date', before.expectedOn || null, after.expectedOn || null)
  return fields
}

// Compares a month with the templates in force for it. Nothing is applied here: the caller shows the list and saves only what the user confirms.
// Monthly exclusions stay as they are; one-off payments and income entered only in this month are never touched.
export function templateChanges(month: string, plan: { payments: MoneyPayment[]; incomes: MoneyIncome[] }, templates: { payments: PaymentTemplate[]; incomes: IncomeTemplate[] }, newId: () => string = () => crypto.randomUUID()): TemplateChange[] {
  const changes: TemplateChange[] = []
  const paymentTemplates = new Map(templates.payments.map((template) => [template.id, template]))
  const incomeTemplates = new Map(templates.incomes.map((template) => [template.id, template]))
  const plannedPayments = new Set(plan.payments.map((payment) => payment.recurringPaymentId).filter(Boolean))
  const plannedIncomes = new Set(plan.incomes.map((income) => income.recurringIncomeId).filter(Boolean))

  for (const payment of plan.payments) {
    if (!payment.recurringPaymentId) continue
    const template = paymentTemplates.get(payment.recurringPaymentId)
    if (!template) { changes.push({ kind: 'payment', type: 'remove', key: `payment:${payment.id}`, name: payment.name, excluded: !payment.enabled, id: payment.id }); continue }
    const after = paymentFromTemplate(month, template, payment)
    const fields = paymentFields(payment, after)
    if (fields.length) changes.push({ kind: 'payment', type: 'update', key: `payment:${payment.id}`, name: payment.name, fields, excluded: !payment.enabled, after })
  }
  for (const template of templates.payments) {
    if (plannedPayments.has(template.id)) continue
    changes.push({ kind: 'payment', type: 'add', key: `payment-template:${template.id}`, name: template.name, after: paymentFromTemplate(month, template, { id: newId(), enabled: true }) })
  }

  for (const income of plan.incomes) {
    if (!income.recurringIncomeId) continue
    const template = incomeTemplates.get(income.recurringIncomeId)
    const excluded = !income.enabled || income.status === 'excluded'
    if (!template) { changes.push({ kind: 'income', type: 'remove', key: `income:${income.id}`, name: income.name, excluded, id: income.id }); continue }
    const after: MoneyIncome = { ...income, name: template.name, amount: template.amount, accountId: template.accountId, expectedOn: dayInMonth(month, template.day) ?? '' }
    const fields = incomeFields(income, after)
    if (fields.length) changes.push({ kind: 'income', type: 'update', key: `income:${income.id}`, name: income.name, fields, excluded, after })
  }
  for (const template of templates.incomes) {
    if (plannedIncomes.has(template.id)) continue
    changes.push({ kind: 'income', type: 'add', key: `income-template:${template.id}`, name: template.name, after: { id: newId(), recurringIncomeId: template.id, name: template.name, amount: template.amount, accountId: template.accountId, expectedOn: dayInMonth(month, template.day) ?? '', enabled: true, status: 'expected' } })
  }
  return changes
}

// Applies the confirmed items to a plan; rows the user did not choose stay exactly as they are.
export function applyTemplateChanges<P extends { payments: MoneyPayment[]; incomes: MoneyIncome[] }>(plan: P, changes: TemplateChange[]): P {
  let payments = plan.payments
  let incomes = plan.incomes
  for (const change of changes) {
    if (change.kind === 'payment') {
      if (change.type === 'add') payments = [...payments, change.after]
      else if (change.type === 'update') payments = payments.map((payment) => payment.id === change.after.id ? change.after : payment)
      else payments = payments.filter((payment) => payment.id !== change.id)
    } else {
      if (change.type === 'add') incomes = [...incomes, change.after]
      else if (change.type === 'update') incomes = incomes.map((income) => income.id === change.after.id ? change.after : income)
      else incomes = incomes.filter((income) => income.id !== change.id)
    }
  }
  return { ...plan, payments, incomes }
}
