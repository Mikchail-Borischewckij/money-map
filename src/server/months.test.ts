import { describe, expect, it } from 'vitest'
import { calendarMonth, monthToStart } from './plans'

describe('which month starts next', () => {
  it('starts the calendar month when there are no months yet', () => {
    expect(monthToStart(null, { year: 2026, month: 9 })).toEqual({ year: 2026, month: 9 })
  })
  it('starts the month after the last one, across the year boundary', () => {
    expect(monthToStart({ year: 2026, month: 9 }, { year: 2026, month: 9 })).toEqual({ year: 2026, month: 10 })
    expect(monthToStart({ year: 2026, month: 12 }, { year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 })
  })
  it('skips to the calendar month after a long pause', () => {
    expect(monthToStart({ year: 2026, month: 5 }, { year: 2026, month: 9 })).toEqual({ year: 2026, month: 9 })
  })
  it('uses Warsaw time for the calendar month', () => {
    expect(calendarMonth(new Date('2026-09-30T22:30:00Z'))).toEqual({ year: 2026, month: 10 })
  })
})

describe('the current period', () => {
  it('belongs to the previous month before the start day', () => {
    expect(calendarMonth(new Date('2026-10-10T10:00:00Z'), 15)).toEqual({ year: 2026, month: 9 })
    expect(calendarMonth(new Date('2026-10-15T10:00:00Z'), 15)).toEqual({ year: 2026, month: 10 })
    expect(calendarMonth(new Date('2027-01-05T10:00:00Z'), 15)).toEqual({ year: 2026, month: 12 })
  })
})

describe('balances date of a new month', () => {
  it('is today inside the period, else its first or last day', async () => {
    const { balancesDate } = await import('./plans')
    const period = { month: '2026-09', startDay: 15 }
    expect(balancesDate(period, '2026-09-25')).toBe('2026-09-25')
    expect(balancesDate(period, '2026-09-10')).toBe('2026-09-15')
    expect(balancesDate(period, '2026-10-20')).toBe('2026-10-14')
  })
})
