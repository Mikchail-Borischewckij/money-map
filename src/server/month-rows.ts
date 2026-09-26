import type { Row } from 'postgres'
import { intArray, type db } from './db'
import type { MoneyIncome, MoneyPayment } from './money'
import { whenever } from '../lib/month-merge'

type Sql = ReturnType<typeof db>

const statusText = (status: MoneyIncome['status']) => status === 'expected' ? 'Expected' : status === 'included' ? 'IncludedInOpeningBalance' : 'Excluded'
const statusValue = (status: string): MoneyIncome['status'] => status === 'Expected' ? 'expected' : status === 'IncludedInOpeningBalance' ? 'included' : 'excluded'
export const isoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
const json = (rows: object[]) => JSON.stringify(rows)

export const toPayment = (row: Row): MoneyPayment => ({
  id: row.id, recurringPaymentId: row.recurring_payment_id, name: row.name_snapshot, amount: Number(row.amount), accountId: row.account_id, due: row.due_date ?? whenever,
  enabled: row.is_enabled, category: row.category_snapshot, schedule: row.schedule_snapshot, weekdays: row.weekdays_snapshot,
  unitPrice: row.unit_price === null ? null : Number(row.unit_price), quantity: row.quantity, exclusionReason: row.exclusion_reason, amountPending: row.amount_pending,
  checked: row.is_checked,
})
export const toIncome = (row: Row): MoneyIncome => ({
  id: row.id, recurringIncomeId: row.recurring_income_id, name: row.name_snapshot, amount: Number(row.amount), accountId: row.account_id,
  expectedOn: row.expected_date ?? '', enabled: row.is_enabled, status: statusValue(row.status), amountPending: row.amount_pending,
  checked: row.is_checked, category: row.category_snapshot ?? '',
})

const incomeRecord = (income: MoneyIncome) => ({
  id: income.id, recurring_income_id: income.recurringIncomeId ?? null, name_snapshot: income.name, amount: income.amount, account_id: income.accountId,
  expected_date: income.expectedOn || null, is_enabled: income.enabled, status: statusText(income.status), amount_pending: Boolean(income.recurringIncomeId && income.amountPending),
  is_checked: income.enabled && Boolean(income.checked), category_snapshot: income.category ?? '',
})
const paymentRecord = (payment: MoneyPayment) => ({
  id: payment.id, recurring_payment_id: payment.recurringPaymentId ?? null, name_snapshot: payment.name, category_snapshot: payment.category, amount: payment.amount,
  account_id: payment.accountId, due_date: isoDate(payment.due), is_enabled: payment.enabled,
  schedule_snapshot: payment.recurringPaymentId ? payment.schedule ?? null : null, weekdays_snapshot: intArray(payment.recurringPaymentId ? payment.weekdays : null),
  unit_price: payment.unitPrice ?? null, quantity: payment.quantity ?? null, exclusion_reason: payment.enabled ? '' : payment.exclusionReason ?? '',
  amount_pending: Boolean(payment.recurringPaymentId && payment.amountPending), is_checked: payment.enabled && Boolean(payment.checked),
})

// Set-based writes from JSON: one statement however many rows, so writing a month stays a single round trip.
export const insertIncomes = (tx: Sql, planId: string, version: number, incomes: MoneyIncome[]) => tx`
  INSERT INTO monthly_incomes (id, monthly_plan_id, recurring_income_id, name_snapshot, amount, account_id, expected_date, is_enabled, status, version, amount_pending, is_checked, category_snapshot)
  SELECT x.id, ${planId}, x.recurring_income_id, x.name_snapshot, x.amount, x.account_id, x.expected_date, x.is_enabled, x.status, ${version}, x.amount_pending, x.is_checked, x.category_snapshot
  FROM jsonb_to_recordset(${json(incomes.map(incomeRecord))}::text::jsonb) AS x(id uuid, recurring_income_id uuid, name_snapshot text, amount bigint, account_id uuid, expected_date date, is_enabled boolean, status text, amount_pending boolean, is_checked boolean, category_snapshot text)`

export const insertPayments = (tx: Sql, planId: string, version: number, payments: MoneyPayment[]) => tx`
  INSERT INTO monthly_payments (id, monthly_plan_id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date, is_enabled, version,
    schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason, amount_pending, is_checked)
  SELECT x.id, ${planId}, x.recurring_payment_id, x.name_snapshot, x.category_snapshot, x.amount, x.account_id, x.due_date, x.is_enabled, ${version},
    x.schedule_snapshot, x.weekdays_snapshot::integer[], x.unit_price, x.quantity, x.exclusion_reason, x.amount_pending, x.is_checked
  FROM jsonb_to_recordset(${json(payments.map(paymentRecord))}::text::jsonb) AS x(id uuid, recurring_payment_id uuid, name_snapshot text, category_snapshot text, amount bigint, account_id uuid,
    due_date date, is_enabled boolean, schedule_snapshot text, weekdays_snapshot text, unit_price bigint, quantity integer, exclusion_reason text, amount_pending boolean, is_checked boolean)`

export const updateIncomes = (tx: Sql, planId: string, version: number, incomes: MoneyIncome[]) => tx`
  UPDATE monthly_incomes m SET name_snapshot = x.name_snapshot, amount = x.amount, account_id = x.account_id, expected_date = x.expected_date,
    is_enabled = x.is_enabled, status = x.status, amount_pending = x.amount_pending, is_checked = x.is_checked, category_snapshot = x.category_snapshot, version = ${version}
  FROM jsonb_to_recordset(${json(incomes.map(incomeRecord))}::text::jsonb) AS x(id uuid, name_snapshot text, amount bigint, account_id uuid, expected_date date, is_enabled boolean, status text, amount_pending boolean, is_checked boolean, category_snapshot text)
  WHERE m.id = x.id AND m.monthly_plan_id = ${planId}`

export const updatePayments = (tx: Sql, planId: string, version: number, payments: MoneyPayment[]) => tx`
  UPDATE monthly_payments m SET name_snapshot = x.name_snapshot, category_snapshot = x.category_snapshot, amount = x.amount, account_id = x.account_id, due_date = x.due_date,
    is_enabled = x.is_enabled, schedule_snapshot = x.schedule_snapshot, weekdays_snapshot = x.weekdays_snapshot::integer[], unit_price = x.unit_price, quantity = x.quantity,
    exclusion_reason = x.exclusion_reason, amount_pending = x.amount_pending, is_checked = x.is_checked, version = ${version}
  FROM jsonb_to_recordset(${json(payments.map(paymentRecord))}::text::jsonb) AS x(id uuid, name_snapshot text, category_snapshot text, amount bigint, account_id uuid,
    due_date date, is_enabled boolean, schedule_snapshot text, weekdays_snapshot text, unit_price bigint, quantity integer, exclusion_reason text, amount_pending boolean, is_checked boolean)
  WHERE m.id = x.id AND m.monthly_plan_id = ${planId}`
