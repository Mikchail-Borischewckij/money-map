import type { db } from './db'
import type { Session } from './auth'
import { insertIncomes, insertPayments, toIncome, toPayment, updateIncomes, updatePayments } from './month-rows'
import { mergeIncome, mergePayment, type IncomeTemplate, type PaymentTemplate } from '../lib/month-merge'
import { dayInPeriod, periodEnd, periodStart, type Period } from '../lib/period'

type Sql = ReturnType<typeof db>
type Kind = 'income' | 'payment'
export type OpenPlan = { id: string; year: number; month: number; startDay: number; balancesOn?: string | null; version: number }

const monthText = (plan: OpenPlan) => `${plan.year}-${String(plan.month).padStart(2, '0')}`
export const periodOfPlan = (plan: OpenPlan): Period => ({ month: monthText(plan), startDay: plan.startDay, from: plan.balancesOn ?? null })
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const inMonth = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре']

export async function lockOpenPlan(tx: Sql, householdId: string): Promise<OpenPlan | null> {
  const rows = await tx`SELECT id, year, month, start_day, balance_date::text, version FROM monthly_plans WHERE household_id = ${householdId} AND status = 'Draft' FOR UPDATE`
  return rows[0] ? { id: rows[0].id, year: rows[0].year, month: rows[0].month, startDay: rows[0].start_day, balancesOn: rows[0].balance_date, version: rows[0].version } : null
}

const incomeTemplate = (row: Record<string, unknown>): IncomeTemplate => ({ id: row.id as string, name: row.name as string, category: row.category as string, accountId: row.account_id as string, amount: Number(row.default_amount), day: row.expected_day as number | null, varies: Boolean(row.amount_varies) })
const paymentTemplate = (row: Record<string, unknown>): PaymentTemplate => ({ id: row.id as string, name: row.name as string, category: row.category as string, accountId: row.account_id as string, amount: Number(row.default_amount), day: row.due_day as number | null, schedule: row.schedule as PaymentTemplate['schedule'], weekdays: row.weekdays as number[] | null, varies: Boolean(row.amount_varies) })

// The settings of one item as they apply to the month, or null when the item is not in force for it.
export async function templateAt(tx: Sql, kind: Kind, id: string, plan: OpenPlan): Promise<PaymentTemplate | IncomeTemplate | null> {
  const first = `${monthText(plan)}-01`
  if (kind === 'income') {
    const rows = await tx`SELECT i.id, v.name, v.default_amount, v.account_id, v.expected_day, i.amount_varies, COALESCE(c.name, '') AS category
      FROM recurring_incomes i JOIN income_template_versions v ON v.recurring_income_id = i.id JOIN accounts a ON a.id = v.account_id
      LEFT JOIN categories c ON c.id = v.category_id
      WHERE i.id = ${id} AND i.is_archived = false AND a.is_archived = false
      AND i.active_from <= ${first}::date AND (i.active_to IS NULL OR i.active_to >= ${first}::date)
      AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)`
    return rows[0] ? incomeTemplate(rows[0]) : null
  }
  const rows = await tx`SELECT p.id, v.name, v.default_amount, v.account_id, v.due_day, v.schedule, v.weekdays, p.amount_varies, COALESCE(c.name, '') AS category
    FROM recurring_payments p JOIN payment_template_versions v ON v.recurring_payment_id = p.id JOIN accounts a ON a.id = v.account_id
    LEFT JOIN categories c ON c.id = v.category_id
    WHERE p.id = ${id} AND p.is_archived = false AND a.is_archived = false
    AND p.active_from <= ${first}::date AND (p.active_to IS NULL OR p.active_to >= ${first}::date)
    AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)`
  return rows[0] ? paymentTemplate(rows[0]) : null
}

async function paymentRow(tx: Sql, planId: string, templateId: string) {
  const rows = await tx`SELECT id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date::text, is_enabled, schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason, amount_pending, is_checked
    FROM monthly_payments WHERE monthly_plan_id = ${planId} AND recurring_payment_id = ${templateId} LIMIT 1`
  return rows[0] ? toPayment(rows[0]) : null
}

async function incomeRow(tx: Sql, planId: string, templateId: string) {
  const rows = await tx`SELECT id, recurring_income_id, name_snapshot, amount, account_id, expected_date::text, is_enabled, status, amount_pending, is_checked, category_snapshot
    FROM monthly_incomes WHERE monthly_plan_id = ${planId} AND recurring_income_id = ${templateId} LIMIT 1`
  return rows[0] ? toIncome(rows[0]) : null
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

async function bump(tx: Sql, session: Session, plan: OpenPlan, version: number, action: string) {
  await Promise.all([
    tx`UPDATE monthly_plans SET version = ${version}, updated_by = ${session.userId}, updated_at = now() WHERE id = ${plan.id}`,
    tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'MonthlyPlan', ${plan.id}, ${action}, ${plan.version}, ${version})`,
  ])
}

// Carries a settings change into the open month (see mergePayment) and returns a short note for the user.
// Closed months are never touched: only the single open month is read and written here.
export async function applyToOpenMonth(tx: Sql, session: Session, kind: Kind, id: string, plan: OpenPlan | null, before: PaymentTemplate | IncomeTemplate | null) {
  if (!plan) return ''
  const period = periodOfPlan(plan)
  const [after, existing] = await Promise.all([templateAt(tx, kind, id, plan), kind === 'payment' ? paymentRow(tx, plan.id, id) : incomeRow(tx, plan.id, id)])
  if (!after) return ''
  const version = plan.version + 1
  const merge = kind === 'payment'
    ? mergePayment(period, existing as ReturnType<typeof toPayment> | null, before as PaymentTemplate | null, after as PaymentTemplate)
    : mergeIncome(period, existing as ReturnType<typeof toIncome> | null, before as IncomeTemplate | null, after as IncomeTemplate)
  const changed = !existing || !same(existing, merge.value)
  if (changed) {
    const write = existing
      ? (kind === 'payment' ? updatePayments(tx, plan.id, version, [merge.value as ReturnType<typeof toPayment>]) : updateIncomes(tx, plan.id, version, [merge.value as ReturnType<typeof toIncome>]))
      : (kind === 'payment' ? insertPayments(tx, plan.id, version, [merge.value as ReturnType<typeof toPayment>]) : insertIncomes(tx, plan.id, version, [merge.value as ReturnType<typeof toIncome>]))
    await write
    await bump(tx, session, plan, version, 'settings')
  }
  if (merge.kept.length) return `В ${inMonth[plan.month - 1]} оставили то, что меняли в месяце: ${merge.kept.join(', ')}.`
  return changed ? `${monthNames[plan.month - 1]} тоже обновлён.` : ''
}

// A new period start day moves the open month to the new dates: regular items get the dates and weekday counts
// of the new period unless they were changed in the month; one-off items keep their day of the month.
export async function shiftOpenMonth(tx: Sql, session: Session, plan: OpenPlan, startDay: number) {
  if (plan.startDay === startDay) return
  const before = periodOfPlan(plan)
  // The balances date stays, moved into the new period if it now falls outside it.
  const shifted: Period = { month: before.month, startDay }
  const from = before.from ? (before.from < periodStart(shifted) ? periodStart(shifted) : before.from > periodEnd(shifted) ? periodEnd(shifted) : before.from) : null
  const after: Period = { ...shifted, from }
  const [payments, incomes] = await Promise.all([
    tx`SELECT id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date::text, is_enabled, schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason, amount_pending, is_checked
      FROM monthly_payments WHERE monthly_plan_id = ${plan.id}`,
    tx`SELECT id, recurring_income_id, name_snapshot, amount, account_id, expected_date::text, is_enabled, status, amount_pending, is_checked, category_snapshot FROM monthly_incomes WHERE monthly_plan_id = ${plan.id}`,
  ])
  const redate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? dayInPeriod(after, Number(date.slice(8, 10))) : null
  const nextPayments = await Promise.all(payments.map(toPayment).map(async (row) => {
    const template = row.recurringPaymentId ? await templateAt(tx, 'payment', row.recurringPaymentId, plan) as PaymentTemplate | null : null
    if (template) return mergePayment(after, row, template, template, undefined, before).value
    return { ...row, due: redate(row.due) ?? row.due }
  }))
  const nextIncomes = await Promise.all(incomes.map(toIncome).map(async (row) => {
    const template = row.recurringIncomeId ? await templateAt(tx, 'income', row.recurringIncomeId, plan) as IncomeTemplate | null : null
    if (template) return mergeIncome(after, row, template, template, undefined, before).value
    return { ...row, expectedOn: redate(row.expectedOn) ?? row.expectedOn }
  }))
  const version = plan.version + 1
  await Promise.all([
    tx`UPDATE monthly_plans SET start_day = ${startDay}, balance_date = ${from} WHERE id = ${plan.id}`,
    updatePayments(tx, plan.id, version, nextPayments),
    updateIncomes(tx, plan.id, version, nextIncomes),
    bump(tx, session, plan, version, 'period'),
  ])
}
