import type { Session } from './auth'
import { db } from './db'
import { storeMonthRate, todayRate } from './usd-rate'
import type { SummaryLine, SummaryMonth } from '../lib/summary'

const monthText = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

// Every month with its incomes (received or expected, not excluded), payments and savings, grouped by category and name.
// Closed months missing a dollar rate (closed before rates were kept, or NBP was down) get it here, once.
export async function readSummary(session: Session): Promise<SummaryMonth[]> {
  const sql = db()
  const [plans, incomes, payments, savings] = await Promise.all([
    sql`SELECT id, year, month, start_day, status, usd_rate, usd_rate_date::text FROM monthly_plans WHERE household_id = ${session.householdId} ORDER BY year, month`,
    sql`SELECT i.monthly_plan_id, i.category_snapshot AS category, i.name_snapshot AS name, SUM(i.amount) AS amount
      FROM monthly_incomes i JOIN monthly_plans p ON p.id = i.monthly_plan_id
      WHERE p.household_id = ${session.householdId} AND i.is_enabled AND i.status <> 'Excluded'
      GROUP BY 1, 2, 3`,
    sql`SELECT m.monthly_plan_id, m.category_snapshot AS category, m.name_snapshot AS name, SUM(m.amount) AS amount
      FROM monthly_payments m JOIN monthly_plans p ON p.id = m.monthly_plan_id
      WHERE p.household_id = ${session.householdId} AND m.is_enabled
      GROUP BY 1, 2, 3`,
    sql`SELECT a.monthly_plan_id, SUM(a.amount) AS amount
      FROM allocations a JOIN monthly_plans p ON p.id = a.monthly_plan_id
      WHERE p.household_id = ${session.householdId} AND a.type = 'savings'
      GROUP BY 1`,
  ])
  const today = plans.some((plan) => plan.status === 'Draft') ? await todayRate() : null
  const missing = plans.filter((plan) => plan.status === 'Finalized' && plan.usd_rate === null)
  const filled = new Map(await Promise.all(missing.map(async (plan) => [plan.id as string, await storeMonthRate(sql, plan as never)] as const)))
  const lines = (rows: typeof incomes, planId: string): SummaryLine[] => rows.filter((row) => row.monthly_plan_id === planId).map((row) => ({ category: row.category ?? '', name: row.name, amount: Number(row.amount) }))
  return plans.map((plan): SummaryMonth => {
    const open = plan.status === 'Draft'
    const rate = open ? today : plan.usd_rate !== null ? { rate: Number(plan.usd_rate), date: plan.usd_rate_date as string } : filled.get(plan.id) ?? null
    return {
      id: plan.id, month: monthText(plan.year, plan.month), startDay: plan.start_day, open,
      rate: rate?.rate ?? null, rateDate: rate?.date ?? null,
      incomes: lines(incomes, plan.id), payments: lines(payments, plan.id),
      savings: Number(savings.find((row) => row.monthly_plan_id === plan.id)?.amount ?? 0),
    }
  })
}
