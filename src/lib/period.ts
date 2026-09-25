// A planning period: it starts on `startDay` of `month` and ends the day before `startDay` of the next month.
// With startDay 1 it is the calendar month. `month` (YYYY-MM) names the period by the month it starts in.
// `from`: the date the balances were entered on. What happened before it is already in the balances,
// so weekly items are counted from it; without it the whole period counts.
export type Period = { month: string; startDay: number; from?: string | null }

export const maxStartDay = 28

const pad = (value: number) => String(value).padStart(2, '0')
const parts = (month: string) => month.split('-').map(Number) as [number, number]
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

export function shiftMonth(month: string, delta: number) {
  const [year, number] = parts(month)
  const date = new Date(Date.UTC(year, number - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`
}

// The given day in a month, moved to its last day when the month is shorter.
export function dateIn(month: string, day: number) {
  const [year, number] = parts(month)
  return `${month}-${pad(Math.min(day, daysIn(year, number)))}`
}

const dayBefore = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

export const periodStart = (period: Period) => dateIn(period.month, period.startDay)
export const periodEnd = (period: Period) => dayBefore(dateIn(shiftMonth(period.month, 1), period.startDay))

// The date a day of the month falls on inside the period: days before the start day belong to the next month.
export function dayInPeriod(period: Period, day: number | null) {
  if (!day) return null
  return day >= period.startDay ? dateIn(period.month, day) : dateIn(shiftMonth(period.month, 1), day)
}

// The first day that still counts: the balances date when it falls inside the period, else the period start.
export const countFrom = (period: Period) => period.from && period.from > periodStart(period) ? period.from : periodStart(period)

// Every day of the period, for choosing the balances date.
export function periodDays(period: Period) {
  const days: string[] = []
  const end = Date.parse(`${periodEnd(period)}T00:00:00Z`)
  for (let time = Date.parse(`${periodStart(period)}T00:00:00Z`); time <= end; time += 86400000) days.push(new Date(time).toISOString().slice(0, 10))
  return days
}

// Occurrences of the weekdays from the balances date to the end of the period. ISO weekdays: 1 = Monday … 7 = Sunday.
export function countWeekdaysInPeriod(period: Period, weekdays: number[]) {
  const end = Date.parse(`${periodEnd(period)}T00:00:00Z`)
  let count = 0
  for (let time = Date.parse(`${countFrom(period)}T00:00:00Z`); time <= end; time += 86400000) {
    if (weekdays.includes(new Date(time).getUTCDay() || 7)) count++
  }
  return count
}

// The period a date belongs to.
export function periodOf(date: string, startDay: number): Period {
  const month = date.slice(0, 7)
  return { month: Number(date.slice(8, 10)) >= startDay ? month : shiftMonth(month, -1), startDay }
}
