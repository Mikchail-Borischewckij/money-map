import { db, intArray } from './db'
import type { Session } from './auth'
import { calculateMoneyPlan, type MoneyPlan } from './money'
import { planInput } from './validation'
import { countWeekdays } from '../lib/schedule'
import { templateChanges, type IncomeTemplate, type PaymentTemplate } from '../lib/template-sync'

const monthText = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
const dayInMonth = (year: number, month: number, day: number | null) => day ? `${monthText(year, month)}-${String(Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate())).padStart(2, '0')}` : null

type PaymentTemplateRow = { default_amount: string | number; due_day: number | null; schedule: 'monthly' | 'weekly'; weekdays: number[] | null }

// A weekly template turns into price × occurrences of its weekdays in the month; a monthly one keeps a fixed amount.
function paymentSnapshot(year: number, month: number, template: PaymentTemplateRow) {
  if (template.schedule === 'weekly' && template.weekdays) {
    const unitPrice = Number(template.default_amount)
    const quantity = countWeekdays(monthText(year, month), template.weekdays)
    return { amount: unitPrice * quantity, unitPrice, quantity, weekdays: template.weekdays, dueDate: null }
  }
  return { amount: Number(template.default_amount), unitPrice: null, quantity: null, weekdays: null, dueDate: dayInMonth(year, month, template.due_day) }
}

type Sql = ReturnType<typeof db>

// Templates in force on the first day of the month, on accounts that are still open. Used both to create a month and to compare it with the directory.
async function activeTemplates(sql: Sql, householdId: string, first: string) {
  const [incomes, payments] = await Promise.all([
    sql`SELECT i.id, v.name, v.default_amount, v.account_id, v.expected_day
      FROM recurring_incomes i JOIN income_template_versions v ON v.recurring_income_id = i.id
      JOIN accounts a ON a.id = v.account_id
      WHERE i.household_id = ${householdId} AND i.is_archived = false AND a.is_archived = false
      AND i.active_from <= ${first}::date AND (i.active_to IS NULL OR i.active_to >= ${first}::date)
      AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)
      ORDER BY i.created_at, i.id`,
    sql`SELECT p.id, v.name, v.default_amount, v.account_id, v.due_day, v.schedule, v.weekdays, COALESCE(c.name, '') AS category
      FROM recurring_payments p JOIN payment_template_versions v ON v.recurring_payment_id = p.id
      JOIN accounts a ON a.id = v.account_id LEFT JOIN categories c ON c.id = v.category_id
      WHERE p.household_id = ${householdId} AND p.is_archived = false AND a.is_archived = false
      AND p.active_from <= ${first}::date AND (p.active_to IS NULL OR p.active_to >= ${first}::date)
      AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)
      ORDER BY p.created_at, p.id`,
  ])
  return {
    incomes: incomes.map((row): IncomeTemplate => ({ id: row.id, name: row.name, accountId: row.account_id, amount: Number(row.default_amount), day: row.expected_day })),
    payments: payments.map((row): PaymentTemplate => ({ id: row.id, name: row.name, category: row.category, accountId: row.account_id, amount: Number(row.default_amount), day: row.due_day, schedule: row.schedule, weekdays: row.weekdays })),
  }
}

export async function listPlans(session: Session) {
  const rows = await db()`SELECT id, year, month, status, version, updated_at, updated_by
    FROM monthly_plans WHERE household_id = ${session.householdId} ORDER BY year DESC, month DESC`
  return Promise.all(rows.map(async (row) => {
    const plan = await readPlan(session, row.id)
    return { ...row, totalAvailable: plan?.summary.totalAvailable ?? 0, totalPayments: plan?.summary.totalPayments ?? 0, totalSavings: plan?.summary.totalSavings ?? 0, freeAfterPlan: plan?.summary.freeAfterPlan ?? 0 }
  }))
}

const nextMonthOf = (year: number, month: number) => month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
const later = (a: { year: number; month: number }, b: { year: number; month: number }) => a.year > b.year || (a.year === b.year && a.month > b.month)

export function calendarMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit' }).formatToParts(now)
  return { year: Number(parts.find((part) => part.type === 'year')?.value), month: Number(parts.find((part) => part.type === 'month')?.value) }
}

// The month to start after the last one: the following month, but never earlier than the calendar month.
export function monthToStart(last: { year: number; month: number } | null, today = calendarMonth()) {
  if (!last) return today
  const next = nextMonthOf(last.year, last.month)
  return later(today, next) ? today : next
}

async function insertPlan(tx: Sql, session: Session, year: number, month: number) {
  const first = `${monthText(year, month)}-01`
  const inserted = await tx`INSERT INTO monthly_plans (household_id, year, month, created_by, updated_by)
    VALUES (${session.householdId}, ${year}, ${month}, ${session.userId}, ${session.userId}) RETURNING id`
  const planId = inserted[0].id as string
  await tx`INSERT INTO account_balances
    (monthly_plan_id, account_id, amount, is_confirmed, name_snapshot, type_snapshot, can_fund_transfers_snapshot, transfer_priority_snapshot)
    SELECT ${planId}, id, 0, false, name, type, can_fund_transfers, transfer_priority
    FROM accounts WHERE household_id = ${session.householdId} AND is_archived = false`
  const { incomes, payments } = await activeTemplates(tx, session.householdId, first)
  for (const income of incomes) await tx`INSERT INTO monthly_incomes
    (monthly_plan_id, recurring_income_id, name_snapshot, amount, account_id, expected_date)
    VALUES (${planId}, ${income.id}, ${income.name}, ${income.amount}, ${income.accountId}, ${dayInMonth(year, month, income.day)})`
  for (const payment of payments) {
    const snapshot = paymentSnapshot(year, month, { default_amount: payment.amount, due_day: payment.day, schedule: payment.schedule, weekdays: payment.weekdays })
    await tx`INSERT INTO monthly_payments
      (monthly_plan_id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date, schedule_snapshot, weekdays_snapshot, unit_price, quantity)
      VALUES (${planId}, ${payment.id}, ${payment.name}, ${payment.category}, ${snapshot.amount}, ${payment.accountId}, ${snapshot.dueDate},
        ${payment.schedule}, ${intArray(snapshot.weekdays)}::integer[], ${snapshot.unitPrice}, ${snapshot.quantity})`
  }
  await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version)
    VALUES (${session.householdId}, ${session.userId}, 'MonthlyPlan', ${planId}, 'create', 1)`
  return planId
}

// Starts the next month from the current settings. Returns the open month instead if one exists, so repeated clicks are harmless.
export async function startMonth(session: Session) {
  const id = await db().begin(async (transaction) => {
    const tx = transaction as unknown as Sql
    await tx`SELECT id FROM households WHERE id = ${session.householdId} FOR UPDATE`
    const open = await tx`SELECT id FROM monthly_plans WHERE household_id = ${session.householdId} AND status = 'Draft'`
    if (open[0]) return open[0].id as string
    const last = await tx`SELECT year, month FROM monthly_plans WHERE household_id = ${session.householdId} ORDER BY year DESC, month DESC LIMIT 1`
    const { year, month } = monthToStart(last[0] ? { year: last[0].year, month: last[0].month } : null)
    return insertPlan(tx, session, year, month)
  })
  return readPlan(session, id)
}

// What the app opens with: the open month, or the last closed one plus the month that can be started next.
// With no months at all, the calendar month is started automatically.
export async function currentMonth(session: Session) {
  const open = await db()`SELECT id FROM monthly_plans WHERE household_id = ${session.householdId} AND status = 'Draft'`
  if (open[0]) return { record: await readPlan(session, open[0].id), next: null }
  const last = await db()`SELECT id, year, month FROM monthly_plans WHERE household_id = ${session.householdId} ORDER BY year DESC, month DESC LIMIT 1`
  if (!last[0]) return { record: await startMonth(session), next: null }
  const next = monthToStart({ year: last[0].year, month: last[0].month })
  return { record: await readPlan(session, last[0].id), next: monthText(next.year, next.month) }
}

export async function readPlan(session: Session, id: string) {
  const rows = await db()`SELECT p.id, p.year, p.month, p.status, p.version, p.balance_date::text,
    p.updated_at, u.display_name AS updated_by_name
    FROM monthly_plans p JOIN users u ON u.id = p.updated_by
    WHERE p.id = ${id} AND p.household_id = ${session.householdId}`
  if (!rows[0]) return null
  const record = rows[0]
  const open = record.status === 'Draft'
  const [accounts, balances, incomes, payments, allocations] = await Promise.all([
    // An open month follows the account settings; a closed month keeps the names and settings it was closed with.
    open
      ? db()`SELECT a.id, a.name, a.type, a.can_fund_transfers, a.transfer_priority, a.display_order, a.version, a.is_archived
        FROM accounts a WHERE a.household_id = ${session.householdId} AND (a.is_archived = false
        OR EXISTS (SELECT 1 FROM monthly_incomes i WHERE i.monthly_plan_id = ${id} AND i.account_id = a.id)
        OR EXISTS (SELECT 1 FROM monthly_payments p WHERE p.monthly_plan_id = ${id} AND p.account_id = a.id)
        OR EXISTS (SELECT 1 FROM allocations l WHERE l.monthly_plan_id = ${id} AND l.account_id = a.id))
        ORDER BY a.display_order, a.created_at, a.id`
      : db()`SELECT a.id, COALESCE(b.name_snapshot, a.name) AS name,
      COALESCE(b.type_snapshot, a.type) AS type,
      COALESCE(b.can_fund_transfers_snapshot, a.can_fund_transfers) AS can_fund_transfers,
      COALESCE(b.transfer_priority_snapshot, a.transfer_priority) AS transfer_priority,
      a.display_order, a.version, a.is_archived
      FROM accounts a LEFT JOIN account_balances b ON b.account_id = a.id AND b.monthly_plan_id = ${id}
      WHERE a.household_id = ${session.householdId} AND
      (b.account_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM monthly_incomes i WHERE i.monthly_plan_id = ${id} AND i.account_id = a.id)
      OR EXISTS (SELECT 1 FROM monthly_payments p WHERE p.monthly_plan_id = ${id} AND p.account_id = a.id)
      OR EXISTS (SELECT 1 FROM allocations l WHERE l.monthly_plan_id = ${id} AND l.account_id = a.id))
      ORDER BY a.display_order, a.created_at, a.id`,
    db()`SELECT account_id, amount, is_confirmed, balance_date::text FROM account_balances WHERE monthly_plan_id = ${id}`,
    db()`SELECT id, recurring_income_id, name_snapshot, amount, account_id, expected_date::text, is_enabled, status FROM monthly_incomes WHERE monthly_plan_id = ${id} ORDER BY id`,
    db()`SELECT id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date::text, is_enabled,
      schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason
      FROM monthly_payments WHERE monthly_plan_id = ${id} ORDER BY id`,
    db()`SELECT id, name, type, amount, account_id FROM allocations WHERE monthly_plan_id = ${id} ORDER BY id`,
  ])
  const balanceMap = new Map(balances.map((balance) => [balance.account_id, Number(balance.amount)]))
  const confirmationMap = new Map(balances.map((balance) => [balance.account_id, Boolean(balance.is_confirmed)]))
  const balanceDateMap = new Map(balances.map((balance) => [balance.account_id, balance.balance_date as string | null]))
  const plan: MoneyPlan = {
    month: monthText(record.year, record.month),
    accounts: accounts.map((account) => ({ id: account.id, name: account.name, kind: account.type, openingBalance: balanceMap.get(account.id) ?? 0, balanceConfirmed: confirmationMap.get(account.id) ?? false, balanceDate: balanceDateMap.get(account.id) ?? null, canFundTransfers: account.can_fund_transfers, priority: account.transfer_priority, version: account.version, isArchived: account.is_archived })),
    incomes: incomes.map((income) => ({ id: income.id, recurringIncomeId: income.recurring_income_id, name: income.name_snapshot, amount: Number(income.amount), accountId: income.account_id, expectedOn: income.expected_date ?? '', enabled: income.is_enabled, status: income.status === 'Expected' ? 'expected' : income.status === 'IncludedInOpeningBalance' ? 'included' : 'excluded' })),
    payments: payments.map((payment) => ({ id: payment.id, recurringPaymentId: payment.recurring_payment_id, name: payment.name_snapshot, amount: Number(payment.amount), accountId: payment.account_id, due: payment.due_date ?? 'в течение месяца', enabled: payment.is_enabled, category: payment.category_snapshot, schedule: payment.schedule_snapshot, weekdays: payment.weekdays_snapshot, unitPrice: payment.unit_price === null ? null : Number(payment.unit_price), quantity: payment.quantity, exclusionReason: payment.exclusion_reason })),
    allocations: allocations.map((allocation) => ({ id: allocation.id, name: allocation.name, amount: Number(allocation.amount), accountId: allocation.account_id, kind: allocation.type })),
  }
  return { id: record.id as string, version: record.version as number, status: record.status as 'Draft' | 'Finalized', updatedAt: record.updated_at, updatedBy: record.updated_by_name, balanceDate: record.balance_date, plan, summary: calculateMoneyPlan(plan) }
}

// Preview of what "update from directory" would change in a draft month. The client applies the chosen items and saves the plan as usual.
export async function planTemplateChanges(session: Session, id: string) {
  const record = await readPlan(session, id)
  if (!record) return { result: 'missing' as const }
  if (record.status !== 'Draft') return { result: 'finalized' as const }
  const templates = await activeTemplates(db(), session.householdId, `${record.plan.month}-01`)
  return { result: 'ok' as const, version: record.version, changes: templateChanges(record.plan.month, record.plan, templates) }
}

export async function savePlan(session: Session, id: string, value: unknown) {
  const input = planInput.parse(value)
  const result = await db().begin(async (tx) => {
    const current = await tx`SELECT version, status, year, month FROM monthly_plans WHERE id = ${id} AND household_id = ${session.householdId} FOR UPDATE`
    if (!current[0]) return 'missing'
    if (current[0].status !== 'Draft') return 'finalized'
    if (current[0].version !== input.expectedVersion) return 'conflict'
    if (input.plan.month !== monthText(current[0].year, current[0].month)) return 'invalid'
    const allowed = await tx`SELECT id FROM accounts WHERE household_id = ${session.householdId}`
    const accountIds = new Set(allowed.map((account) => account.id as string))
    const allIds = [...input.plan.accounts.map((account) => account.id), ...input.plan.incomes.map((income) => income.accountId), ...input.plan.payments.map((payment) => payment.accountId), ...input.plan.allocations.map((allocation) => allocation.accountId)]
    if (allIds.some((accountId) => !accountIds.has(accountId))) return 'invalid'
    const [incomeTemplates, paymentTemplates] = await Promise.all([
      tx`SELECT id FROM recurring_incomes WHERE household_id = ${session.householdId}`,
      tx`SELECT id FROM recurring_payments WHERE household_id = ${session.householdId}`,
    ])
    const incomeTemplateIds = new Set(incomeTemplates.map((item) => item.id as string))
    const paymentTemplateIds = new Set(paymentTemplates.map((item) => item.id as string))
    if (input.plan.incomes.some((income) => income.recurringIncomeId && !incomeTemplateIds.has(income.recurringIncomeId)) || input.plan.payments.some((payment) => payment.recurringPaymentId && !paymentTemplateIds.has(payment.recurringPaymentId))) return 'invalid'
    const newVersion = current[0].version + 1
    await tx`UPDATE monthly_plans SET version = ${newVersion}, updated_by = ${session.userId}, updated_at = now() WHERE id = ${id}`
    await tx`DELETE FROM account_balances WHERE monthly_plan_id = ${id}`
    await tx`DELETE FROM monthly_incomes WHERE monthly_plan_id = ${id}`
    await tx`DELETE FROM monthly_payments WHERE monthly_plan_id = ${id}`
    await tx`DELETE FROM allocations WHERE monthly_plan_id = ${id}`
    for (const account of input.plan.accounts) await tx`INSERT INTO account_balances
      (monthly_plan_id, account_id, amount, balance_date, is_confirmed, name_snapshot, type_snapshot, can_fund_transfers_snapshot, transfer_priority_snapshot)
      SELECT ${id}, a.id, ${account.openingBalance}, ${account.balanceDate ?? null}, ${account.balanceConfirmed ?? false}, a.name, a.type, a.can_fund_transfers, a.transfer_priority
      FROM accounts a WHERE a.id = ${account.id} AND a.household_id = ${session.householdId}`
    for (const income of input.plan.incomes) await tx`INSERT INTO monthly_incomes
      (id, monthly_plan_id, recurring_income_id, name_snapshot, amount, account_id, expected_date, is_enabled, status, version)
      VALUES (${income.id}, ${id}, ${income.recurringIncomeId ?? null}, ${income.name}, ${income.amount}, ${income.accountId}, ${income.expectedOn || null}, ${income.enabled}, ${income.status === 'expected' ? 'Expected' : income.status === 'included' ? 'IncludedInOpeningBalance' : 'Excluded'}, ${newVersion})`
    for (const payment of input.plan.payments) await tx`INSERT INTO monthly_payments
      (id, monthly_plan_id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date, is_enabled, version,
        schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason)
      VALUES (${payment.id}, ${id}, ${payment.recurringPaymentId ?? null}, ${payment.name}, ${payment.category}, ${payment.amount}, ${payment.accountId}, ${/^\d{4}-\d{2}-\d{2}$/.test(payment.due) ? payment.due : null}, ${payment.enabled}, ${newVersion},
        ${payment.recurringPaymentId ? payment.schedule ?? null : null}, ${intArray(payment.recurringPaymentId ? payment.weekdays : null)}::integer[], ${payment.unitPrice ?? null}, ${payment.quantity ?? null}, ${payment.enabled ? '' : payment.exclusionReason ?? ''})`
    for (const allocation of input.plan.allocations) await tx`INSERT INTO allocations
      (id, monthly_plan_id, name, type, amount, account_id, version)
      VALUES (${allocation.id}, ${id}, ${allocation.name}, ${allocation.kind}, ${allocation.amount}, ${allocation.accountId}, ${newVersion})`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'MonthlyPlan', ${id}, 'update', ${current[0].version}, ${newVersion})`
    return 'saved'
  })
  return { result, current: await readPlan(session, id) }
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
      ) AS missing, (SELECT COUNT(*) FROM account_balances WHERE monthly_plan_id = ${id}) AS account_count`
      if (incomplete[0].missing || Number(incomplete[0].account_count) === 0) return 'incomplete'
      await tx`UPDATE account_balances b SET name_snapshot = a.name, type_snapshot = a.type,
        can_fund_transfers_snapshot = a.can_fund_transfers, transfer_priority_snapshot = a.transfer_priority
        FROM accounts a WHERE b.account_id = a.id AND b.monthly_plan_id = ${id}`
    }
    await tx`UPDATE monthly_plans SET status = ${to}, version = version + 1, updated_by = ${session.userId}, updated_at = now() WHERE id = ${id}`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'MonthlyPlan', ${id}, ${action}, ${expectedVersion}, ${expectedVersion + 1})`
    return 'saved'
  })
  return { result: updated, current: await readPlan(session, id) }
}

export async function resetMonthlyPayment(session: Session, planId: string, paymentId: string, expectedVersion: number) {
  const result = await db().begin(async (tx) => {
    const plans = await tx`SELECT year, month, version, status FROM monthly_plans WHERE id = ${planId} AND household_id = ${session.householdId} FOR UPDATE`
    if (!plans[0]) return 'missing'
    if (plans[0].version !== expectedVersion || plans[0].status !== 'Draft') return 'conflict'
    const rows = await tx`SELECT recurring_payment_id FROM monthly_payments WHERE id = ${paymentId} AND monthly_plan_id = ${planId}`
    if (!rows[0]?.recurring_payment_id) return 'missing'
    const first = `${monthText(plans[0].year, plans[0].month)}-01`
    const versions = await tx`SELECT v.name, v.default_amount, v.account_id, v.due_day, v.schedule, v.weekdays, COALESCE(c.name, '') AS category
      FROM recurring_payments p JOIN payment_template_versions v ON v.recurring_payment_id = p.id
      LEFT JOIN categories c ON c.id = v.category_id
      WHERE p.id = ${rows[0].recurring_payment_id} AND p.household_id = ${session.householdId}
      AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)
      LIMIT 1`
    if (!versions[0]) return 'missing'
    const version = versions[0]
    const snapshot = paymentSnapshot(plans[0].year, plans[0].month, version as unknown as PaymentTemplateRow)
    const newVersion = expectedVersion + 1
    await tx`UPDATE monthly_payments SET name_snapshot = ${version.name}, category_snapshot = ${version.category},
      amount = ${snapshot.amount}, account_id = ${version.account_id}, due_date = ${snapshot.dueDate},
      schedule_snapshot = ${version.schedule}, weekdays_snapshot = ${intArray(snapshot.weekdays)}::integer[],
      unit_price = ${snapshot.unitPrice}, quantity = ${snapshot.quantity}, exclusion_reason = '',
      is_enabled = true, version = ${newVersion} WHERE id = ${paymentId}`
    await tx`UPDATE monthly_plans SET version = ${newVersion}, updated_by = ${session.userId}, updated_at = now() WHERE id = ${planId}`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'MonthlyPayment', ${paymentId}, 'reset', ${expectedVersion}, ${newVersion})`
    return 'saved'
  })
  return { result, current: await readPlan(session, planId) }
}

export async function resetMonthlyIncome(session: Session, planId: string, incomeId: string, expectedVersion: number) {
  const result = await db().begin(async (tx) => {
    const plans = await tx`SELECT year, month, version, status FROM monthly_plans WHERE id = ${planId} AND household_id = ${session.householdId} FOR UPDATE`
    if (!plans[0]) return 'missing'
    if (plans[0].version !== expectedVersion || plans[0].status !== 'Draft') return 'conflict'
    const rows = await tx`SELECT recurring_income_id FROM monthly_incomes WHERE id = ${incomeId} AND monthly_plan_id = ${planId}`
    if (!rows[0]?.recurring_income_id) return 'missing'
    const first = `${monthText(plans[0].year, plans[0].month)}-01`
    const versions = await tx`SELECT v.name, v.default_amount, v.account_id, v.expected_day
      FROM recurring_incomes i JOIN income_template_versions v ON v.recurring_income_id = i.id
      WHERE i.id = ${rows[0].recurring_income_id} AND i.household_id = ${session.householdId}
      AND v.effective_from <= ${first}::date AND (v.effective_to IS NULL OR v.effective_to >= ${first}::date)
      LIMIT 1`
    if (!versions[0]) return 'missing'
    const version = versions[0]
    const newVersion = expectedVersion + 1
    await tx`UPDATE monthly_incomes SET name_snapshot = ${version.name}, amount = ${version.default_amount},
      account_id = ${version.account_id}, expected_date = ${dayInMonth(plans[0].year, plans[0].month, version.expected_day)},
      is_enabled = true, status = 'Expected', version = ${newVersion} WHERE id = ${incomeId}`
    await tx`UPDATE monthly_plans SET version = ${newVersion}, updated_by = ${session.userId}, updated_at = now() WHERE id = ${planId}`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'MonthlyIncome', ${incomeId}, 'reset', ${expectedVersion}, ${newVersion})`
    return 'saved'
  })
  return { result, current: await readPlan(session, planId) }
}
