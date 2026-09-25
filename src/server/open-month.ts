import { intArray, type db } from './db'
import type { Session } from './auth'
import type { MoneyIncome, MoneyPayment } from './money'
import { mergeIncome, mergePayment, type IncomeTemplate, type PaymentTemplate } from '../lib/month-merge'

type Sql = ReturnType<typeof db>
type Kind = 'income' | 'payment'
export type OpenPlan = { id: string; year: number; month: number; version: number }

const monthText = (plan: OpenPlan) => `${plan.year}-${String(plan.month).padStart(2, '0')}`
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const inMonth = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре']

export async function lockOpenPlan(tx: Sql, householdId: string): Promise<OpenPlan | null> {
  const rows = await tx`SELECT id, year, month, version FROM monthly_plans WHERE household_id = ${householdId} AND status = 'Draft' FOR UPDATE`
  return rows[0] ? { id: rows[0].id, year: rows[0].year, month: rows[0].month, version: rows[0].version } : null
}

// The settings of one item as they apply to the month, or null when the item is not in force for it.
export async function templateAt(tx: Sql, kind: Kind, id: string, plan: OpenPlan): Promise<PaymentTemplate | IncomeTemplate | null> {
  const first = `${monthText(plan)}-01`
  if (kind === 'income') {
    const rows = await tx`SELECT i.id, v.name, v.default_amount, v.account_id, v.expected_day, i.amount_varies
      FROM recurring_incomes i JOIN income_template_versions v ON v.recurring_income_id = i.id JOIN accounts a ON a.id = v.account_id
      WHERE i.id = ${id} AND i.is_archived = false AND a.is_archived = false
      AND i.active_from <= ${first}::date AND (i.active_to IS NULL OR i.active_to >= ${first}::date)
      AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)`
    return rows[0] ? { id: rows[0].id, name: rows[0].name, accountId: rows[0].account_id, amount: Number(rows[0].default_amount), day: rows[0].expected_day, varies: rows[0].amount_varies } : null
  }
  const rows = await tx`SELECT p.id, v.name, v.default_amount, v.account_id, v.due_day, v.schedule, v.weekdays, COALESCE(c.name, '') AS category
    FROM recurring_payments p JOIN payment_template_versions v ON v.recurring_payment_id = p.id JOIN accounts a ON a.id = v.account_id
    LEFT JOIN categories c ON c.id = v.category_id
    WHERE p.id = ${id} AND p.is_archived = false AND a.is_archived = false
    AND p.active_from <= ${first}::date AND (p.active_to IS NULL OR p.active_to >= ${first}::date)
    AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)`
  return rows[0] ? { id: rows[0].id, name: rows[0].name, category: rows[0].category, accountId: rows[0].account_id, amount: Number(rows[0].default_amount), day: rows[0].due_day, schedule: rows[0].schedule, weekdays: rows[0].weekdays } : null
}

async function paymentRow(tx: Sql, planId: string, templateId: string): Promise<MoneyPayment | null> {
  const rows = await tx`SELECT id, name_snapshot, category_snapshot, amount, account_id, due_date::text, is_enabled, schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason
    FROM monthly_payments WHERE monthly_plan_id = ${planId} AND recurring_payment_id = ${templateId} LIMIT 1`
  const row = rows[0]
  return row ? { id: row.id, recurringPaymentId: templateId, name: row.name_snapshot, category: row.category_snapshot, amount: Number(row.amount), accountId: row.account_id, due: row.due_date ?? 'в течение месяца', enabled: row.is_enabled, schedule: row.schedule_snapshot, weekdays: row.weekdays_snapshot, unitPrice: row.unit_price === null ? null : Number(row.unit_price), quantity: row.quantity, exclusionReason: row.exclusion_reason } : null
}

async function incomeRow(tx: Sql, planId: string, templateId: string): Promise<MoneyIncome | null> {
  const rows = await tx`SELECT id, name_snapshot, amount, account_id, expected_date::text, is_enabled, status, amount_pending FROM monthly_incomes WHERE monthly_plan_id = ${planId} AND recurring_income_id = ${templateId} LIMIT 1`
  const row = rows[0]
  return row ? { id: row.id, recurringIncomeId: templateId, name: row.name_snapshot, amount: Number(row.amount), accountId: row.account_id, expectedOn: row.expected_date ?? '', enabled: row.is_enabled, status: row.status === 'Expected' ? 'expected' : row.status === 'IncludedInOpeningBalance' ? 'included' : 'excluded', amountPending: row.amount_pending } : null
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Carries a settings change into the open month (see mergePayment) and returns a short note for the user.
// Closed months are never touched: only the single open month is read and written here.
export async function applyToOpenMonth(tx: Sql, session: Session, kind: Kind, id: string, plan: OpenPlan | null, before: PaymentTemplate | IncomeTemplate | null) {
  if (!plan) return ''
  const after = await templateAt(tx, kind, id, plan)
  if (!after) return ''
  const version = plan.version + 1
  let changed = false
  let kept: string[] = []
  if (kind === 'payment') {
    const row = await paymentRow(tx, plan.id, id)
    const merge = mergePayment(monthText(plan), row, before as PaymentTemplate | null, after as PaymentTemplate)
    kept = merge.kept
    const value = merge.value
    const due = /^\d{4}-\d{2}-\d{2}$/.test(value.due) ? value.due : null
    if (!row) {
      await tx`INSERT INTO monthly_payments (id, monthly_plan_id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date, is_enabled, version, schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason)
        VALUES (${value.id}, ${plan.id}, ${id}, ${value.name}, ${value.category}, ${value.amount}, ${value.accountId}, ${due}, true, ${version}, ${value.schedule ?? null}, ${intArray(value.weekdays)}::integer[], ${value.unitPrice ?? null}, ${value.quantity ?? null}, '')`
      changed = true
    } else if (!same(row, value)) {
      await tx`UPDATE monthly_payments SET name_snapshot = ${value.name}, category_snapshot = ${value.category}, amount = ${value.amount}, account_id = ${value.accountId}, due_date = ${due},
        schedule_snapshot = ${value.schedule ?? null}, weekdays_snapshot = ${intArray(value.weekdays)}::integer[], unit_price = ${value.unitPrice ?? null}, quantity = ${value.quantity ?? null}, version = ${version}
        WHERE id = ${row.id}`
      changed = true
    }
  } else {
    const row = await incomeRow(tx, plan.id, id)
    const merge = mergeIncome(monthText(plan), row, before as IncomeTemplate | null, after as IncomeTemplate)
    kept = merge.kept
    const value = merge.value
    if (!row) {
      await tx`INSERT INTO monthly_incomes (id, monthly_plan_id, recurring_income_id, name_snapshot, amount, account_id, expected_date, is_enabled, status, version, amount_pending)
        VALUES (${value.id}, ${plan.id}, ${id}, ${value.name}, ${value.amount}, ${value.accountId}, ${value.expectedOn || null}, true, 'Expected', ${version}, ${Boolean(value.amountPending)})`
      changed = true
    } else if (!same(row, value)) {
      await tx`UPDATE monthly_incomes SET name_snapshot = ${value.name}, amount = ${value.amount}, account_id = ${value.accountId}, expected_date = ${value.expectedOn || null}, amount_pending = ${Boolean(value.amountPending)}, version = ${version} WHERE id = ${row.id}`
      changed = true
    }
  }
  if (changed) {
    await tx`UPDATE monthly_plans SET version = ${version}, updated_by = ${session.userId}, updated_at = now() WHERE id = ${plan.id}`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'MonthlyPlan', ${plan.id}, 'settings', ${plan.version}, ${version})`
  }
  if (kept.length) return `В ${inMonth[plan.month - 1]} оставили то, что меняли в месяце: ${kept.join(', ')}.`
  return changed ? `${monthNames[plan.month - 1]} тоже обновлён.` : ''
}
