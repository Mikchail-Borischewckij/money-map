import { db } from './db'
import { warsawDate } from './plans'
import { periodEnd } from '../lib/period'

type Sql = ReturnType<typeof db>
export type UsdRate = { rate: number; date: string }

const daysBefore = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10)

// The NBP mid rate on the date or the last business day before it. Null when NBP does not answer.
export async function nbpRate(date: string, fetcher: typeof fetch = fetch): Promise<UsdRate | null> {
  try {
    const response = await fetcher(`https://api.nbp.pl/api/exchangerates/rates/a/usd/${daysBefore(date, 10)}/${date}/?format=json`, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
    if (!response.ok) return null
    const body = await response.json() as { rates?: { effectiveDate: string; mid: number }[] }
    const last = body.rates?.at(-1)
    return last && last.mid > 0 ? { rate: last.mid, date: last.effectiveDate } : null
  } catch {
    return null
  }
}

// Today's rate for the open month, asked from NBP at most once an hour.
let cached: { value: UsdRate; day: string; at: number } | null = null
export async function todayRate() {
  const day = warsawDate()
  if (cached && cached.day === day && Date.now() - cached.at < 3600_000) return cached.value
  const value = await nbpRate(day)
  if (value) cached = { value, day, at: Date.now() }
  return value ?? cached?.value ?? null
}

// A closed month keeps the rate of its last day (or of the day it was closed, if that came first).
export const rateDayFor = (month: string, startDay: number, today = warsawDate()) => {
  const end = periodEnd({ month, startDay })
  return end < today ? end : today
}

export async function storeMonthRate(sql: Sql, plan: { id: string; year: number; month: number; start_day: number }) {
  const rate = await nbpRate(rateDayFor(`${plan.year}-${String(plan.month).padStart(2, '0')}`, plan.start_day))
  if (rate) await sql`UPDATE monthly_plans SET usd_rate = ${rate.rate}, usd_rate_date = ${rate.date} WHERE id = ${plan.id} AND status = 'Finalized'`
  return rate
}
