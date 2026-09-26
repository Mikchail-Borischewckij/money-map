import { db, intArray } from './db'
import type { Session } from './auth'
import { calculateMoneyPlan, type MoneyPlan } from './money'
import { insertIncomes, insertPayments, isoDate } from './month-rows'
import { periodOfPlan, templateAt, type OpenPlan } from './open-month'
import { planInput } from './validation'
import { incomeFromTemplate, paymentFromTemplate, whenever, type IncomeTemplate, type PaymentTemplate } from '../lib/month-merge'
import { periodEnd, periodOf, periodStart, type Period } from '../lib/period'

const monthText = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

type Sql = ReturnType<typeof db>

// Templates in force on the first day of the month, on accounts that are still open. Used both to create a month and to compare it with the directory.
async function activeTemplates(sql: Sql, householdId: string, first: string) {
  const [incomes, payments] = await Promise.all([
    sql`SELECT i.id, v.name, v.default_amount, v.account_id, v.expected_day, i.amount_varies
      FROM recurring_incomes i JOIN income_template_versions v ON v.recurring_income_id = i.id
      JOIN accounts a ON a.id = v.account_id
      WHERE i.household_id = ${householdId} AND i.is_archived = false AND a.is_archived = false
      AND i.active_from <= ${first}::date AND (i.active_to IS NULL OR i.active_to >= ${first}::date)
      AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)
      ORDER BY i.created_at, i.id`,
    sql`SELECT p.id, v.name, v.default_amount, v.account_id, v.due_day, v.schedule, v.weekdays, p.amount_varies, COALESCE(c.name, '') AS category
      FROM recurring_payments p JOIN payment_template_versions v ON v.recurring_payment_id = p.id
      JOIN accounts a ON a.id = v.account_id LEFT JOIN categories c ON c.id = v.category_id
      WHERE p.household_id = ${householdId} AND p.is_archived = false AND a.is_archived = false
      AND p.active_from <= ${first}::date AND (p.active_to IS NULL OR p.active_to >= ${first}::date)
      AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)
      ORDER BY p.created_at, p.id`,
  ])
  return {
    incomes: incomes.map((row): IncomeTemplate => ({ id: row.id, name: row.name, accountId: row.account_id, amount: Number(row.default_amount), day: row.expected_day, varies: row.amount_varies })),
    payments: payments.map((row): PaymentTemplate => ({ id: row.id, name: row.name, category: row.category, accountId: row.account_id, amount: Number(row.default_amount), day: row.due_day, schedule: row.schedule, weekdays: row.weekdays, varies: row.amount_varies })),
  }
}

export async function listPlans(session: Session) {
  // Totals for every month in one query; the same sums as calculateMoneyPlan.
  const rows = await db()`SELECT p.id, p.year, p.month, p.start_day, p.status, p.version, p.updated_at, p.updated_by,
    COALESCE((SELECT SUM(amount) FROM account_balances WHERE monthly_plan_id = p.id), 0)
      + COALESCE((SELECT SUM(amount) FROM monthly_incomes WHERE monthly_plan_id = p.id AND is_enabled AND status = 'Expected'), 0) AS total_available,
    COALESCE((SELECT SUM(amount) FROM monthly_payments WHERE monthly_plan_id = p.id AND is_enabled), 0) AS total_payments,
    COALESCE((SELECT SUM(amount) FROM allocations WHERE monthly_plan_id = p.id AND type = 'savings'), 0) AS total_savings,
    COALESCE((SELECT SUM(amount) FROM allocations WHERE monthly_plan_id = p.id), 0)
      + COALESCE((SELECT SUM(keep_amount_snapshot) FROM account_balances WHERE monthly_plan_id = p.id), 0) AS total_set_aside
    FROM monthly_plans p WHERE p.household_id = ${session.householdId} ORDER BY p.year DESC, p.month DESC`
  return rows.map(({ total_available, total_payments, total_savings, total_set_aside, start_day, ...row }) => ({
    ...row, startDay: start_day, totalAvailable: Number(total_available), totalPayments: Number(total_payments), totalSavings: Number(total_savings),
    freeAfterPlan: Number(total_available) - Number(total_payments) - Number(total_set_aside),
  }))
}

const nextMonthOf = (year: number, month: number) => month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
const later = (a: { year: number; month: number }, b: { year: number; month: number }) => a.year > b.year || (a.year === b.year && a.month > b.month)

export const warsawDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

// The period today falls in (Warsaw time), named by the month it starts in.
export function calendarMonth(now = new Date(), startDay = 1) {
  const [year, month] = periodOf(warsawDate(now), startDay).month.split('-').map(Number)
  return { year, month }
}

// The month to start after the last one: the following month, but never earlier than the current period.
export function monthToStart(last: { year: number; month: number } | null, today = calendarMonth()) {
  if (!last) return today
  const next = nextMonthOf(last.year, last.month)
  return later(today, next) ? today : next
}

export async function periodStartDay(sql: Sql, householdId: string) {
  const rows = await sql`SELECT period_start_day FROM households WHERE id = ${householdId}`
  return (rows[0]?.period_start_day as number | undefined) ?? 1
}

const json = (rows: object[]) => JSON.stringify(rows)

// A month started after its first day has its balances entered today, so what already happened is not counted again.
export function balancesDate(period: Period, today = warsawDate()) {
  return today < periodStart(period) ? periodStart(period) : today > periodEnd(period) ? periodEnd(period) : today
}

async function insertPlan(tx: Sql, session: Session, year: number, month: number, startDay: number) {
  const base: Period = { month: monthText(year, month), startDay }
  const period: Period = { ...base, from: balancesDate(base) }
  const inserted = await tx`INSERT INTO monthly_plans (household_id, year, month, start_day, balance_date, created_by, updated_by)
    VALUES (${session.householdId}, ${year}, ${month}, ${startDay}, ${period.from ?? null}, ${session.userId}, ${session.userId}) RETURNING id`
  const planId = inserted[0].id as string
  const { incomes, payments } = await activeTemplates(tx, session.householdId, `${period.month}-01`)
  await Promise.all([
    tx`INSERT INTO account_balances
      (monthly_plan_id, account_id, amount, is_confirmed, name_snapshot, bank_snapshot, type_snapshot, can_fund_transfers_snapshot, transfer_priority_snapshot, sweep_to_snapshot, keep_amount_snapshot)
      SELECT ${planId}, id, 0, false, name, bank, type, can_fund_transfers, transfer_priority, sweep_to_account_id, keep_amount
      FROM accounts WHERE household_id = ${session.householdId} AND is_archived = false`,
    insertIncomes(tx, planId, 1, incomes.map((income) => incomeFromTemplate(period, income, crypto.randomUUID()))),
    insertPayments(tx, planId, 1, payments.map((payment) => paymentFromTemplate(period, payment, crypto.randomUUID()))),
    tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'MonthlyPlan', ${planId}, 'create', 1)`,
  ])
  return planId
}

// Starts the next month from the current settings. Returns the open month instead if one exists, so repeated clicks are harmless.
export async function startMonth(session: Session) {
  const id = await db().begin(async (transaction) => {
    const tx = transaction as unknown as Sql
    const household = await tx`SELECT period_start_day FROM households WHERE id = ${session.householdId} FOR UPDATE`
    const open = await tx`SELECT id FROM monthly_plans WHERE household_id = ${session.householdId} AND status = 'Draft'`
    if (open[0]) return open[0].id as string
    const startDay = household[0]?.period_start_day ?? 1
    const last = await tx`SELECT year, month FROM monthly_plans WHERE household_id = ${session.householdId} ORDER BY year DESC, month DESC LIMIT 1`
    const { year, month } = monthToStart(last[0] ? { year: last[0].year, month: last[0].month } : null, calendarMonth(new Date(), startDay))
    return insertPlan(tx, session, year, month, startDay)
  })
  return readPlan(session, id)
}

// What the app opens with: the open month, or the last closed one plus the month that can be started next.
// With no months at all, the current period is started automatically.
export async function currentMonth(session: Session) {
  const [open, last, startDay] = await Promise.all([
    db()`SELECT id FROM monthly_plans WHERE household_id = ${session.householdId} AND status = 'Draft'`,
    db()`SELECT id, year, month FROM monthly_plans WHERE household_id = ${session.householdId} ORDER BY year DESC, month DESC LIMIT 1`,
    periodStartDay(db(), session.householdId),
  ])
  if (open[0]) return { record: await readPlan(session, open[0].id), next: null }
  if (!last[0]) return { record: await startMonth(session), next: null }
  const next = monthToStart({ year: last[0].year, month: last[0].month }, calendarMonth(new Date(), startDay))
  return { record: await readPlan(session, last[0].id), next: monthText(next.year, next.month) }
}

export async function readPlan(session: Session, id: string) {
  const rows = await db()`SELECT p.id, p.year, p.month, p.start_day, p.status, p.version, p.balance_date::text,
    p.updated_at, u.display_name AS updated_by_name
    FROM monthly_plans p JOIN users u ON u.id = p.updated_by
    WHERE p.id = ${id} AND p.household_id = ${session.householdId}`
  if (!rows[0]) return null
  const record = rows[0]
  const open = record.status === 'Draft'
  const [accounts, balances, incomes, payments, allocations, done] = await Promise.all([
    // An open month follows the account settings; a closed month keeps the names and settings it was closed with.
    open
      ? db()`SELECT a.id, a.name, a.bank, a.type, a.can_fund_transfers, a.transfer_priority, a.display_order, a.version, a.is_archived, a.sweep_to_account_id, a.keep_amount
        FROM accounts a WHERE a.household_id = ${session.householdId} AND (a.is_archived = false
        OR EXISTS (SELECT 1 FROM monthly_incomes i WHERE i.monthly_plan_id = ${id} AND i.account_id = a.id)
        OR EXISTS (SELECT 1 FROM monthly_payments p WHERE p.monthly_plan_id = ${id} AND p.account_id = a.id)
        OR EXISTS (SELECT 1 FROM allocations l WHERE l.monthly_plan_id = ${id} AND l.account_id = a.id)
        OR EXISTS (SELECT 1 FROM monthly_transfers t WHERE t.monthly_plan_id = ${id} AND a.id IN (t.from_account_id, t.to_account_id)))
        ORDER BY a.display_order, a.created_at, a.id`
      : db()`SELECT a.id, COALESCE(b.name_snapshot, a.name) AS name,
      COALESCE(b.bank_snapshot, a.bank) AS bank,
      COALESCE(b.type_snapshot, a.type) AS type,
      COALESCE(b.can_fund_transfers_snapshot, a.can_fund_transfers) AS can_fund_transfers,
      COALESCE(b.transfer_priority_snapshot, a.transfer_priority) AS transfer_priority,
      a.display_order, a.version, a.is_archived, b.sweep_to_snapshot AS sweep_to_account_id, COALESCE(b.keep_amount_snapshot, 0) AS keep_amount
      FROM accounts a LEFT JOIN account_balances b ON b.account_id = a.id AND b.monthly_plan_id = ${id}
      WHERE a.household_id = ${session.householdId} AND
      (b.account_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM monthly_incomes i WHERE i.monthly_plan_id = ${id} AND i.account_id = a.id)
      OR EXISTS (SELECT 1 FROM monthly_payments p WHERE p.monthly_plan_id = ${id} AND p.account_id = a.id)
      OR EXISTS (SELECT 1 FROM allocations l WHERE l.monthly_plan_id = ${id} AND l.account_id = a.id)
      OR EXISTS (SELECT 1 FROM monthly_transfers t WHERE t.monthly_plan_id = ${id} AND a.id IN (t.from_account_id, t.to_account_id)))
      ORDER BY a.display_order, a.created_at, a.id`,
    db()`SELECT account_id, amount, is_confirmed, balance_date::text, keep_amount_snapshot FROM account_balances WHERE monthly_plan_id = ${id}`,
    db()`SELECT id, recurring_income_id, name_snapshot, amount, account_id, expected_date::text, is_enabled, status, amount_pending, is_checked FROM monthly_incomes WHERE monthly_plan_id = ${id} ORDER BY id`,
    db()`SELECT id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date::text, is_enabled,
      schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason, amount_pending, is_checked
      FROM monthly_payments WHERE monthly_plan_id = ${id} ORDER BY id`,
    db()`SELECT id, name, type, amount, account_id FROM allocations WHERE monthly_plan_id = ${id} ORDER BY id`,
    db()`SELECT id, from_account_id, to_account_id, amount FROM monthly_transfers WHERE monthly_plan_id = ${id} ORDER BY id`,
  ])
  const balanceMap = new Map(balances.map((balance) => [balance.account_id, balance]))
  const plan: MoneyPlan = {
    month: monthText(record.year, record.month),
    startDay: record.start_day,
    balancesOn: record.balance_date ?? null,
    accounts: accounts.map((account) => {
      const balance = balanceMap.get(account.id)
      return {
        id: account.id, name: account.name, bank: account.bank, kind: account.type, openingBalance: balance ? Number(balance.amount) : 0, balanceConfirmed: Boolean(balance?.is_confirmed), balanceDate: balance?.balance_date ?? null,
        canFundTransfers: account.can_fund_transfers, priority: account.transfer_priority, version: account.version, isArchived: account.is_archived,
        // The amount to keep is set per month (starting from the account setting); an account new to the month uses the setting.
        sweepToAccountId: account.sweep_to_account_id ?? null, keepAmount: Number(balance?.keep_amount_snapshot ?? account.keep_amount ?? 0),
      }
    }),
    incomes: incomes.map((income) => ({ id: income.id, recurringIncomeId: income.recurring_income_id, name: income.name_snapshot, amount: Number(income.amount), accountId: income.account_id, expectedOn: income.expected_date ?? '', enabled: income.is_enabled, status: income.status === 'Expected' ? 'expected' : income.status === 'IncludedInOpeningBalance' ? 'included' : 'excluded', amountPending: income.amount_pending, checked: income.is_checked })),
    payments: payments.map((payment) => ({ id: payment.id, recurringPaymentId: payment.recurring_payment_id, name: payment.name_snapshot, amount: Number(payment.amount), accountId: payment.account_id, due: payment.due_date ?? whenever, enabled: payment.is_enabled, category: payment.category_snapshot, schedule: payment.schedule_snapshot, weekdays: payment.weekdays_snapshot, unitPrice: payment.unit_price === null ? null : Number(payment.unit_price), quantity: payment.quantity, exclusionReason: payment.exclusion_reason, amountPending: payment.amount_pending, checked: payment.is_checked })),
    allocations: allocations.map((allocation) => ({ id: allocation.id, name: allocation.name, amount: Number(allocation.amount), accountId: allocation.account_id, kind: allocation.type })),
    doneTransfers: done.map((transfer) => ({ id: transfer.id, fromAccountId: transfer.from_account_id, toAccountId: transfer.to_account_id, amount: Number(transfer.amount) })),
  }
  return { id: record.id as string, version: record.version as number, status: record.status as 'Draft' | 'Finalized', updatedAt: record.updated_at, updatedBy: record.updated_by_name, balanceDate: record.balance_date, plan, summary: calculateMoneyPlan(plan) }
}

// The month is replaced with a few set-based statements sent together in one round trip, so saving does not slow
// down as the month grows. The reply carries only what the client needs: the new version and the summary.
export async function savePlan(session: Session, id: string, value: unknown) {
  const input = planInput.parse(value)
  const plan = input.plan
  const result = await db().begin(async (transaction) => {
    const tx = transaction as unknown as Sql
    const [current, allowed, incomeTemplates, paymentTemplates] = await Promise.all([
      tx`SELECT version, status, year, month, start_day FROM monthly_plans WHERE id = ${id} AND household_id = ${session.householdId} FOR UPDATE`,
      tx`SELECT id, bank, type, sweep_to_account_id FROM accounts WHERE household_id = ${session.householdId}`,
      tx`SELECT id FROM recurring_incomes WHERE household_id = ${session.householdId}`,
      tx`SELECT id FROM recurring_payments WHERE household_id = ${session.householdId}`,
    ])
    if (!current[0]) return 'missing'
    if (current[0].status !== 'Draft') return 'finalized'
    if (current[0].version !== input.expectedVersion) return 'conflict'
    if (plan.month !== monthText(current[0].year, current[0].month)) return 'invalid'
    const period: Period = { month: plan.month, startDay: current[0].start_day }
    if (plan.balancesOn && (plan.balancesOn < periodStart(period) || plan.balancesOn > periodEnd(period))) return 'invalid'
    const accountIds = new Set(allowed.map((account) => account.id as string))
    const allIds = [...plan.accounts.map((account) => account.id), ...plan.incomes.map((income) => income.accountId), ...plan.payments.map((payment) => payment.accountId), ...plan.allocations.map((allocation) => allocation.accountId)]
    if (allIds.some((accountId) => !accountIds.has(accountId))) return 'invalid'
    const incomeTemplateIds = new Set(incomeTemplates.map((item) => item.id as string))
    const paymentTemplateIds = new Set(paymentTemplates.map((item) => item.id as string))
    if (plan.incomes.some((income) => income.recurringIncomeId && !incomeTemplateIds.has(income.recurringIncomeId)) || plan.payments.some((payment) => payment.recurringPaymentId && !paymentTemplateIds.has(payment.recurringPaymentId))) return 'invalid'
    const newVersion = current[0].version + 1
    const balances = plan.accounts.map((account) => ({ account_id: account.id, amount: account.openingBalance, balance_date: account.balanceDate ?? null, is_confirmed: account.balanceConfirmed ?? false, keep_amount: account.keepAmount ?? 0 }))
    // Queries issued together on the transaction's connection are pipelined and run in this order.
    await Promise.all([
      tx`UPDATE monthly_plans SET version = ${newVersion}, balance_date = ${plan.balancesOn ?? null}, updated_by = ${session.userId}, updated_at = now() WHERE id = ${id}`,
      tx`DELETE FROM account_balances WHERE monthly_plan_id = ${id}`,
      tx`DELETE FROM monthly_incomes WHERE monthly_plan_id = ${id}`,
      tx`DELETE FROM monthly_payments WHERE monthly_plan_id = ${id}`,
      tx`DELETE FROM allocations WHERE monthly_plan_id = ${id}`,
      tx`DELETE FROM monthly_transfers WHERE monthly_plan_id = ${id}`,
      tx`INSERT INTO account_balances (monthly_plan_id, account_id, amount, balance_date, is_confirmed, name_snapshot, bank_snapshot, type_snapshot, can_fund_transfers_snapshot, transfer_priority_snapshot, sweep_to_snapshot, keep_amount_snapshot)
        SELECT ${id}, a.id, x.amount, x.balance_date, x.is_confirmed, a.name, a.bank, a.type, a.can_fund_transfers, a.transfer_priority, a.sweep_to_account_id, x.keep_amount
        FROM jsonb_to_recordset(${json(balances)}::text::jsonb) AS x(account_id uuid, amount bigint, balance_date date, is_confirmed boolean, keep_amount bigint)
        JOIN accounts a ON a.id = x.account_id AND a.household_id = ${session.householdId}`,
      insertIncomes(tx, id, newVersion, plan.incomes),
      insertPayments(tx, id, newVersion, plan.payments),
      tx`INSERT INTO allocations (id, monthly_plan_id, name, type, amount, account_id, version)
        SELECT x.id, ${id}, x.name, x.type, x.amount, x.account_id, ${newVersion}
        FROM jsonb_to_recordset(${json(plan.allocations.map((allocation) => ({ id: allocation.id, name: allocation.name, type: allocation.kind, amount: allocation.amount, account_id: allocation.accountId })))}::text::jsonb)
        AS x(id uuid, name text, type text, amount bigint, account_id uuid)`,
      tx`INSERT INTO monthly_transfers (id, monthly_plan_id, from_account_id, to_account_id, amount)
        SELECT x.id, ${id}, x.from_account_id, x.to_account_id, x.amount
        FROM jsonb_to_recordset(${json(plan.doneTransfers.map((transfer) => ({ id: transfer.id, from_account_id: transfer.fromAccountId, to_account_id: transfer.toAccountId, amount: transfer.amount })))}::text::jsonb)
        AS x(id uuid, from_account_id uuid, to_account_id uuid, amount bigint)`,
      tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
        VALUES (${session.householdId}, ${session.userId}, 'MonthlyPlan', ${id}, 'update', ${current[0].version}, ${newVersion})`,
    ])
    // The summary uses the account type and sweep from settings, not whatever the client sent; the amount to keep is the month's own.
    const settings = new Map(allowed.map((account) => [account.id as string, account]))
    const accounts = plan.accounts.map((account) => {
      const stored = settings.get(account.id)
      return { ...account, kind: stored?.type ?? account.kind, sweepToAccountId: stored?.sweep_to_account_id ?? null }
    })
    return { version: newVersion as number, summary: calculateMoneyPlan({ ...plan, startDay: current[0].start_day, accounts }) }
  })
  if (typeof result === 'object') return { result: 'saved' as const, current: { id, version: result.version, summary: result.summary } }
  return { result, current: result === 'conflict' || result === 'finalized' ? await readPlan(session, id) : null }
}

export async function changePlanStatus(session: Session, id: string, action: 'finalize' | 'reopen', expectedVersion: number) {
  const from = action === 'finalize' ? 'Draft' : 'Finalized'
  const to = action === 'finalize' ? 'Finalized' : 'Draft'
  const updated = await db().begin(async (tx) => {
    await tx`SELECT id FROM households WHERE id = ${session.householdId} FOR UPDATE`
    const current = await tx`SELECT version, status, year, month FROM monthly_plans WHERE id = ${id} AND household_id = ${session.householdId} FOR UPDATE`
    if (!current[0]) return 'missing'
    if (current[0].version !== expectedVersion || current[0].status !== from) return 'conflict'
    if (action === 'reopen') {
      const blocking = await tx`SELECT 1 FROM monthly_plans WHERE household_id = ${session.householdId} AND id <> ${id}
        AND (status = 'Draft' OR year > ${current[0].year} OR (year = ${current[0].year} AND month > ${current[0].month}))`
      if (blocking.length > 0) return 'blocked'
    }
    if (action === 'finalize') {
      const incomplete = await tx`SELECT (
        EXISTS (SELECT 1 FROM account_balances WHERE monthly_plan_id = ${id} AND is_confirmed = false)
        OR EXISTS (SELECT 1 FROM accounts a LEFT JOIN account_balances b ON b.account_id = a.id AND b.monthly_plan_id = ${id}
          WHERE a.household_id = ${session.householdId} AND a.is_archived = false AND b.account_id IS NULL)
        OR EXISTS (SELECT 1 FROM monthly_payments WHERE monthly_plan_id = ${id} AND is_enabled AND NOT is_checked)
        OR EXISTS (SELECT 1 FROM monthly_incomes WHERE monthly_plan_id = ${id} AND is_enabled AND status <> 'Excluded' AND NOT is_checked)
      ) AS missing, (SELECT COUNT(*) FROM account_balances WHERE monthly_plan_id = ${id}) AS account_count`
      if (incomplete[0].missing || Number(incomplete[0].account_count) === 0) return 'incomplete'
      // Every transfer the plan needs must be made (marked done) before the month is closed.
      const record = await readPlan(session, id)
      if (record?.summary.transfers.some((transfer) => !transfer.done)) return 'incomplete'
      await tx`UPDATE account_balances b SET name_snapshot = a.name, bank_snapshot = a.bank, type_snapshot = a.type,
        can_fund_transfers_snapshot = a.can_fund_transfers, transfer_priority_snapshot = a.transfer_priority,
        sweep_to_snapshot = a.sweep_to_account_id
        FROM accounts a WHERE b.account_id = a.id AND b.monthly_plan_id = ${id}`
    }
    await tx`UPDATE monthly_plans SET status = ${to}, version = version + 1, updated_by = ${session.userId}, updated_at = now() WHERE id = ${id}`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'MonthlyPlan', ${id}, ${action}, ${expectedVersion}, ${expectedVersion + 1})`
    return 'saved'
  })
  return { result: updated, current: await readPlan(session, id) }
}

// Puts one regular item of the open month back to what settings say for it.
async function resetItem(session: Session, kind: 'payment' | 'income', planId: string, itemId: string, expectedVersion: number) {
  const result = await db().begin(async (transaction) => {
    const tx = transaction as unknown as Sql
    const plans = await tx`SELECT id, year, month, start_day, balance_date::text, version, status FROM monthly_plans WHERE id = ${planId} AND household_id = ${session.householdId} FOR UPDATE`
    if (!plans[0]) return 'missing'
    if (plans[0].version !== expectedVersion || plans[0].status !== 'Draft') return 'conflict'
    const plan: OpenPlan = { id: plans[0].id, year: plans[0].year, month: plans[0].month, startDay: plans[0].start_day, balancesOn: plans[0].balance_date, version: plans[0].version }
    const period = periodOfPlan(plan)
    const rows = kind === 'payment'
      ? await tx`SELECT recurring_payment_id AS template_id FROM monthly_payments WHERE id = ${itemId} AND monthly_plan_id = ${planId}`
      : await tx`SELECT recurring_income_id AS template_id FROM monthly_incomes WHERE id = ${itemId} AND monthly_plan_id = ${planId}`
    if (!rows[0]?.template_id) return 'missing'
    const template = await templateAt(tx, kind, rows[0].template_id, plan)
    if (!template) return 'missing'
    const newVersion = expectedVersion + 1
    if (kind === 'payment') {
      const value = paymentFromTemplate(period, template as PaymentTemplate, itemId)
      await tx`UPDATE monthly_payments SET name_snapshot = ${value.name}, category_snapshot = ${value.category},
        amount = ${value.amount}, account_id = ${value.accountId}, due_date = ${isoDate(value.due)},
        schedule_snapshot = ${value.schedule ?? null}, weekdays_snapshot = ${intArray(value.weekdays)}::integer[],
        unit_price = ${value.unitPrice ?? null}, quantity = ${value.quantity ?? null}, exclusion_reason = '',
        is_enabled = true, amount_pending = ${Boolean(value.amountPending)}, is_checked = false, version = ${newVersion} WHERE id = ${itemId}`
    } else {
      const value = incomeFromTemplate(period, template as IncomeTemplate, itemId)
      await tx`UPDATE monthly_incomes SET name_snapshot = ${value.name}, amount = ${value.amount},
        account_id = ${value.accountId}, expected_date = ${value.expectedOn || null},
        is_enabled = true, status = 'Expected', amount_pending = ${Boolean(value.amountPending)}, is_checked = false, version = ${newVersion} WHERE id = ${itemId}`
    }
    await Promise.all([
      tx`UPDATE monthly_plans SET version = ${newVersion}, updated_by = ${session.userId}, updated_at = now() WHERE id = ${planId}`,
      tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
        VALUES (${session.householdId}, ${session.userId}, ${kind === 'payment' ? 'MonthlyPayment' : 'MonthlyIncome'}, ${itemId}, 'reset', ${expectedVersion}, ${newVersion})`,
    ])
    return 'saved'
  })
  return { result, current: await readPlan(session, planId) }
}

export const resetMonthlyPayment = (session: Session, planId: string, paymentId: string, expectedVersion: number) => resetItem(session, 'payment', planId, paymentId, expectedVersion)
export const resetMonthlyIncome = (session: Session, planId: string, incomeId: string, expectedVersion: number) => resetItem(session, 'income', planId, incomeId, expectedVersion)
