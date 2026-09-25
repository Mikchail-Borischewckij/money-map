import { getSession, privateHeaders } from '@/server/auth'
import { db } from '@/server/db'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  const h = session.householdId
  const [household, users, accounts, categories, recurringIncomes, recurringPayments, plans, balances, incomes, payments, allocations, audit] = await Promise.all([
    db()`SELECT id, name, currency, time_zone, created_at, updated_at FROM households WHERE id = ${h}`,
    db()`SELECT id, household_id, google_subject, email, display_name, is_active, created_at, updated_at FROM users WHERE household_id = ${h}`,
    db()`SELECT * FROM accounts WHERE household_id = ${h}`,
    db()`SELECT * FROM categories WHERE household_id = ${h}`,
    db()`SELECT * FROM recurring_incomes WHERE household_id = ${h}`,
    db()`SELECT * FROM recurring_payments WHERE household_id = ${h}`,
    db()`SELECT * FROM monthly_plans WHERE household_id = ${h}`,
    db()`SELECT b.* FROM account_balances b JOIN monthly_plans p ON p.id = b.monthly_plan_id WHERE p.household_id = ${h}`,
    db()`SELECT i.* FROM monthly_incomes i JOIN monthly_plans p ON p.id = i.monthly_plan_id WHERE p.household_id = ${h}`,
    db()`SELECT m.* FROM monthly_payments m JOIN monthly_plans p ON p.id = m.monthly_plan_id WHERE p.household_id = ${h}`,
    db()`SELECT a.* FROM allocations a JOIN monthly_plans p ON p.id = a.monthly_plan_id WHERE p.household_id = ${h}`,
    db()`SELECT * FROM audit_events WHERE household_id = ${h}`,
  ])
  return new Response(JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), household: household[0], users, accounts, categories, recurringIncomes, recurringPayments, plans, balances, incomes, payments, allocations, audit }), {
    headers: { ...privateHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="moneymap-export.json"' },
  })
}
