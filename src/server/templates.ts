import type { Session } from './auth'
import { db } from './db'

export type TemplateKind = 'income' | 'payment'
export type TemplateValue = {
  name: string
  defaultAmount: number
  accountId: string
  day: number | null
  activeFrom: string
  activeTo: string | null
  categoryId?: string | null
  version?: number
}

export async function listTemplates(session: Session, kind: TemplateKind) {
  if (kind === 'income') return db()`SELECT i.id, i.name, i.default_amount, i.account_id, i.expected_day AS day,
    i.active_from::text, i.active_to::text, i.is_archived, i.version, v.effective_from::text AS latest_effective_from
    FROM recurring_incomes i JOIN LATERAL (SELECT effective_from FROM income_template_versions
      WHERE recurring_income_id = i.id ORDER BY effective_from DESC LIMIT 1) v ON true
    WHERE i.household_id = ${session.householdId} ORDER BY i.name`
  return db()`SELECT p.id, p.name, p.default_amount, p.account_id, p.due_day AS day, p.category_id,
    p.active_from::text, p.active_to::text, p.is_archived, p.version, v.effective_from::text AS latest_effective_from
    FROM recurring_payments p JOIN LATERAL (SELECT effective_from FROM payment_template_versions
      WHERE recurring_payment_id = p.id ORDER BY effective_from DESC LIMIT 1) v ON true
    WHERE p.household_id = ${session.householdId} ORDER BY p.name`
}

async function referencesValid(session: Session, value: TemplateValue) {
  const account = await db()`SELECT id FROM accounts WHERE id = ${value.accountId} AND household_id = ${session.householdId} AND is_archived = false`
  if (!account[0]) return false
  if (value.categoryId) {
    const category = await db()`SELECT id FROM categories WHERE id = ${value.categoryId} AND household_id = ${session.householdId} AND is_archived = false`
    if (!category[0]) return false
  }
  return true
}

export async function createTemplate(session: Session, kind: TemplateKind, value: TemplateValue) {
  if (!await referencesValid(session, value)) return null
  return db().begin(async (tx) => {
    if (kind === 'income') {
      const rows = await tx`INSERT INTO recurring_incomes (household_id, name, default_amount, account_id, expected_day, active_from, active_to)
        VALUES (${session.householdId}, ${value.name}, ${value.defaultAmount}, ${value.accountId}, ${value.day}, ${value.activeFrom}, ${value.activeTo}) RETURNING *`
      await tx`INSERT INTO income_template_versions (recurring_income_id, effective_from, name, default_amount, account_id, expected_day)
        VALUES (${rows[0].id}, ${value.activeFrom}, ${value.name}, ${value.defaultAmount}, ${value.accountId}, ${value.day})`
      await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version)
        VALUES (${session.householdId}, ${session.userId}, 'RecurringIncome', ${rows[0].id}, 'create', 1)`
      return rows[0]
    }
    const rows = await tx`INSERT INTO recurring_payments (household_id, name, default_amount, account_id, due_day, category_id, active_from, active_to)
      VALUES (${session.householdId}, ${value.name}, ${value.defaultAmount}, ${value.accountId}, ${value.day}, ${value.categoryId ?? null}, ${value.activeFrom}, ${value.activeTo}) RETURNING *`
    await tx`INSERT INTO payment_template_versions (recurring_payment_id, effective_from, name, category_id, default_amount, account_id, due_day)
      VALUES (${rows[0].id}, ${value.activeFrom}, ${value.name}, ${value.categoryId ?? null}, ${value.defaultAmount}, ${value.accountId}, ${value.day})`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'RecurringPayment', ${rows[0].id}, 'create', 1)`
    return rows[0]
  })
}

export async function updateTemplate(session: Session, kind: TemplateKind, id: string, value: TemplateValue) {
  const version = value.version
  if (!version || !await referencesValid(session, value)) return null
  return db().begin(async (tx) => {
    const current = kind === 'income'
      ? await tx`SELECT version, active_from::text FROM recurring_incomes WHERE id = ${id} AND household_id = ${session.householdId} FOR UPDATE`
      : await tx`SELECT version, active_from::text FROM recurring_payments WHERE id = ${id} AND household_id = ${session.householdId} FOR UPDATE`
    if (!current[0] || current[0].version !== version) return null
    const latest = kind === 'income'
      ? await tx`SELECT id, effective_from::text FROM income_template_versions WHERE recurring_income_id = ${id} ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`
      : await tx`SELECT id, effective_from::text FROM payment_template_versions WHERE recurring_payment_id = ${id} ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`
    if (!latest[0] || value.activeFrom < latest[0].effective_from) return null
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
        account_id = ${value.accountId}, expected_day = ${value.day}, active_to = ${value.activeTo},
        version = version + 1, updated_at = now() WHERE id = ${id} RETURNING *`
      await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
        VALUES (${session.householdId}, ${session.userId}, 'RecurringIncome', ${id}, 'update', ${version}, ${version + 1})`
      return rows[0]
    }
    if (value.activeFrom > latest[0].effective_from) {
      await tx`UPDATE payment_template_versions SET effective_to = (${value.activeFrom}::date - 1) WHERE id = ${latest[0].id}`
      await tx`INSERT INTO payment_template_versions (recurring_payment_id, effective_from, name, category_id, default_amount, account_id, due_day)
        VALUES (${id}, ${value.activeFrom}, ${value.name}, ${value.categoryId ?? null}, ${value.defaultAmount}, ${value.accountId}, ${value.day})`
    } else {
      await tx`UPDATE payment_template_versions SET name = ${value.name}, category_id = ${value.categoryId ?? null},
        default_amount = ${value.defaultAmount}, account_id = ${value.accountId}, due_day = ${value.day} WHERE id = ${latest[0].id}`
    }
    const rows = await tx`UPDATE recurring_payments SET name = ${value.name}, category_id = ${value.categoryId ?? null},
      default_amount = ${value.defaultAmount}, account_id = ${value.accountId}, due_day = ${value.day},
      active_to = ${value.activeTo}, version = version + 1, updated_at = now() WHERE id = ${id} RETURNING *`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'RecurringPayment', ${id}, 'update', ${version}, ${version + 1})`
    return rows[0]
  })
}
