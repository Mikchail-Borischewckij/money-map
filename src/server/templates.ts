import type { Session } from './auth'
import { db, intArray } from './db'
import { calendarMonth, monthToStart } from './plans'
import { applyToOpenMonth, lockOpenPlan, templateAt } from './open-month'

type Sql = ReturnType<typeof db>

export type TemplateKind = 'income' | 'payment'
export type TemplateValue = {
  name: string
  defaultAmount: number
  accountId: string
  day: number | null
  ended: boolean
  categoryId?: string | null
  version?: number
  schedule?: 'monthly' | 'weekly'
  weekdays?: number[] | null
  amountVaries?: boolean
}

const firstOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}-01`
const dayBefore = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

// Settings changes apply from the open month (it picks them up via "update from settings") or, with no open month,
// from the month that will be started next. Closed months keep their snapshots either way.
// A template that is "no longer needed" stays in the open month and is left out of every later one.
export async function settingsWindow(session: Session) {
  const plans = await db()`SELECT year, month, status FROM monthly_plans WHERE household_id = ${session.householdId}
    ORDER BY (status = 'Draft') DESC, year DESC, month DESC LIMIT 1`
  if (plans[0]?.status === 'Draft') {
    const next = plans[0].month === 12 ? firstOf(plans[0].year + 1, 1) : firstOf(plans[0].year, plans[0].month + 1)
    return { effectiveFrom: firstOf(plans[0].year, plans[0].month), endDate: dayBefore(next) }
  }
  const start = plans[0] ? monthToStart({ year: plans[0].year, month: plans[0].month }) : calendarMonth()
  const effectiveFrom = firstOf(start.year, start.month)
  return { effectiveFrom, endDate: dayBefore(effectiveFrom) }
}

export async function listTemplates(session: Session, kind: TemplateKind) {
  if (kind === 'income') return db()`SELECT i.id, i.name, i.default_amount, i.account_id, i.expected_day AS day, i.amount_varies,
    i.active_from::text, i.active_to::text, i.is_archived, i.version, v.effective_from::text AS latest_effective_from
    FROM recurring_incomes i JOIN LATERAL (SELECT effective_from FROM income_template_versions
      WHERE recurring_income_id = i.id ORDER BY effective_from DESC LIMIT 1) v ON true
    WHERE i.household_id = ${session.householdId} ORDER BY i.name`
  return db()`SELECT p.id, p.name, p.default_amount, p.account_id, p.due_day AS day, p.category_id, p.schedule, p.weekdays,
    p.active_from::text, p.active_to::text, p.is_archived, p.version, v.effective_from::text AS latest_effective_from
    FROM recurring_payments p JOIN LATERAL (SELECT effective_from FROM payment_template_versions
      WHERE recurring_payment_id = p.id ORDER BY effective_from DESC LIMIT 1) v ON true
    WHERE p.household_id = ${session.householdId} ORDER BY p.name`
}

async function referencesValid(session: Session, value: TemplateValue) {
  const [account, category] = await Promise.all([
    db()`SELECT id FROM accounts WHERE id = ${value.accountId} AND household_id = ${session.householdId} AND is_archived = false`,
    value.categoryId ? db()`SELECT id FROM categories WHERE id = ${value.categoryId} AND household_id = ${session.householdId} AND is_archived = false` : Promise.resolve([true]),
  ])
  return Boolean(account[0] && category[0])
}

export async function createTemplate(session: Session, kind: TemplateKind, input: TemplateValue) {
  const [valid, window] = await Promise.all([referencesValid(session, input), settingsWindow(session)])
  if (!valid) return null
  const value = { ...input, activeFrom: window.effectiveFrom, activeTo: input.ended ? window.endDate : null }
  if (value.activeTo && value.activeTo < value.activeFrom) return null
  return db().begin(async (transaction) => {
    const tx = transaction as unknown as Sql
    const plan = await lockOpenPlan(tx, session.householdId)
    if (kind === 'income') {
      const rows = await tx`INSERT INTO recurring_incomes (household_id, name, default_amount, account_id, expected_day, active_from, active_to, amount_varies)
        VALUES (${session.householdId}, ${value.name}, ${value.defaultAmount}, ${value.accountId}, ${value.day}, ${value.activeFrom}, ${value.activeTo}, ${value.amountVaries ?? false}) RETURNING *`
      await tx`INSERT INTO income_template_versions (recurring_income_id, effective_from, name, default_amount, account_id, expected_day)
        VALUES (${rows[0].id}, ${value.activeFrom}, ${value.name}, ${value.defaultAmount}, ${value.accountId}, ${value.day})`
      await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version)
        VALUES (${session.householdId}, ${session.userId}, 'RecurringIncome', ${rows[0].id}, 'create', 1)`
      return { ...rows[0], monthNote: await applyToOpenMonth(tx, session, kind, rows[0].id, plan, null) }
    }
    const schedule = value.schedule ?? 'monthly'
    const weekdays = intArray(value.weekdays)
    const rows = await tx`INSERT INTO recurring_payments (household_id, name, default_amount, account_id, due_day, category_id, active_from, active_to, schedule, weekdays)
      VALUES (${session.householdId}, ${value.name}, ${value.defaultAmount}, ${value.accountId}, ${value.day}, ${value.categoryId ?? null}, ${value.activeFrom}, ${value.activeTo}, ${schedule}, ${weekdays}::integer[]) RETURNING *`
    await tx`INSERT INTO payment_template_versions (recurring_payment_id, effective_from, name, category_id, default_amount, account_id, due_day, schedule, weekdays)
      VALUES (${rows[0].id}, ${value.activeFrom}, ${value.name}, ${value.categoryId ?? null}, ${value.defaultAmount}, ${value.accountId}, ${value.day}, ${schedule}, ${weekdays}::integer[])`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'RecurringPayment', ${rows[0].id}, 'create', 1)`
    return { ...rows[0], monthNote: await applyToOpenMonth(tx, session, kind, rows[0].id, plan, null) }
  })
}

export async function updateTemplate(session: Session, kind: TemplateKind, id: string, input: TemplateValue) {
  const version = input.version
  if (!version) return null
  const [valid, window] = await Promise.all([referencesValid(session, input), settingsWindow(session)])
  if (!valid) return null
  return db().begin(async (transaction) => {
    const tx = transaction as unknown as Sql
    const plan = await lockOpenPlan(tx, session.householdId)
    const current = kind === 'income'
      ? await tx`SELECT version, active_from::text, active_to::text FROM recurring_incomes WHERE id = ${id} AND household_id = ${session.householdId} FOR UPDATE`
      : await tx`SELECT version, active_from::text, active_to::text FROM recurring_payments WHERE id = ${id} AND household_id = ${session.householdId} FOR UPDATE`
    if (!current[0] || current[0].version !== version) return null
    const before = plan ? await templateAt(tx, kind, id, plan) : null
    // An already ended template keeps its original end, so editing it never brings it back into months in between.
    const value = { ...input, activeFrom: window.effectiveFrom, activeTo: input.ended ? current[0].active_to ?? window.endDate : null }
    if (value.activeTo && value.activeTo < current[0].active_from) return null
    const latest = kind === 'income'
      ? await tx`SELECT id, effective_from::text FROM income_template_versions WHERE recurring_income_id = ${id} ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`
      : await tx`SELECT id, effective_from::text FROM payment_template_versions WHERE recurring_payment_id = ${id} ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`
    // A version that starts before the settings month may already be in closed months, so it is closed off and a new one begins.
    // A version starting at or after it is not used by any closed month and is edited in place.
    if (!latest[0]) return null
    if (kind === 'income') {
      if (value.activeFrom > latest[0].effective_from) {
        await tx`UPDATE income_template_versions SET effective_to = (${value.activeFrom}::date - 1) WHERE id = ${latest[0].id}`
        await tx`INSERT INTO income_template_versions (recurring_income_id, effective_from, name, default_amount, account_id, expected_day)
          VALUES (${id}, ${value.activeFrom}, ${value.name}, ${value.defaultAmount}, ${value.accountId}, ${value.day})`
      } else {
        await tx`UPDATE income_template_versions SET name = ${value.name}, default_amount = ${value.defaultAmount},
          account_id = ${value.accountId}, expected_day = ${value.day} WHERE id = ${latest[0].id}`
      }
      const rows = await tx`UPDATE recurring_incomes SET name = ${value.name}, default_amount = ${value.defaultAmount},
        account_id = ${value.accountId}, expected_day = ${value.day}, active_to = ${value.activeTo}, amount_varies = ${value.amountVaries ?? false},
        version = version + 1, updated_at = now() WHERE id = ${id} RETURNING *`
      await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
        VALUES (${session.householdId}, ${session.userId}, 'RecurringIncome', ${id}, 'update', ${version}, ${version + 1})`
      return { ...rows[0], monthNote: await applyToOpenMonth(tx, session, kind, id, plan, before) }
    }
    const schedule = value.schedule ?? 'monthly'
    const weekdays = intArray(value.weekdays)
    if (value.activeFrom > latest[0].effective_from) {
      await tx`UPDATE payment_template_versions SET effective_to = (${value.activeFrom}::date - 1) WHERE id = ${latest[0].id}`
      await tx`INSERT INTO payment_template_versions (recurring_payment_id, effective_from, name, category_id, default_amount, account_id, due_day, schedule, weekdays)
        VALUES (${id}, ${value.activeFrom}, ${value.name}, ${value.categoryId ?? null}, ${value.defaultAmount}, ${value.accountId}, ${value.day}, ${schedule}, ${weekdays}::integer[])`
    } else {
      await tx`UPDATE payment_template_versions SET name = ${value.name}, category_id = ${value.categoryId ?? null},
        default_amount = ${value.defaultAmount}, account_id = ${value.accountId}, due_day = ${value.day},
        schedule = ${schedule}, weekdays = ${weekdays}::integer[] WHERE id = ${latest[0].id}`
    }
    const rows = await tx`UPDATE recurring_payments SET name = ${value.name}, category_id = ${value.categoryId ?? null},
      default_amount = ${value.defaultAmount}, account_id = ${value.accountId}, due_day = ${value.day},
      schedule = ${schedule}, weekdays = ${weekdays}::integer[],
      active_to = ${value.activeTo}, version = version + 1, updated_at = now() WHERE id = ${id} RETURNING *`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'RecurringPayment', ${id}, 'update', ${version}, ${version + 1})`
    return { ...rows[0], monthNote: await applyToOpenMonth(tx, session, kind, id, plan, before) }
  })
}
