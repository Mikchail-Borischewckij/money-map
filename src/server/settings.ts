import type { Session } from './auth'
import { db } from './db'
import { lockOpenPlan, shiftOpenMonth } from './open-month'
import { periodStartDay } from './plans'

type Sql = ReturnType<typeof db>

export async function readSettings(session: Session) {
  return { periodStartDay: await periodStartDay(db(), session.householdId) }
}

// The new start day applies to the open month right away and to every later one. Closed months keep their dates.
export async function saveSettings(session: Session, periodStartDay: number) {
  await db().begin(async (transaction) => {
    const tx = transaction as unknown as Sql
    await tx`SELECT id FROM households WHERE id = ${session.householdId} FOR UPDATE`
    const plan = await lockOpenPlan(tx, session.householdId)
    await tx`UPDATE households SET period_start_day = ${periodStartDay}, updated_at = now() WHERE id = ${session.householdId}`
    if (plan) await shiftOpenMonth(tx, session, plan, periodStartDay)
  })
  return readSettings(session)
}
