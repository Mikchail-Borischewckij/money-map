import { describe, expect, it } from 'vitest'
import { countWeekdays, weekdayLabel } from './schedule'
import { planInput } from './server/validation'

describe('countWeekdays', () => {
  it('counts Mondays and Thursdays in a month', () => {
    // October 2026 starts on Thursday: 4 Mondays (5, 12, 19, 26) and 5 Thursdays (1, 8, 15, 22, 29).
    expect(countWeekdays('2026-10', [1, 4])).toBe(9)
    // February 2027 has exactly four of every weekday.
    expect(countWeekdays('2027-02', [1, 4])).toBe(8)
    expect(countWeekdays('2026-10', [])).toBe(0)
  })

  it('labels weekdays in calendar order', () => {
    expect(weekdayLabel([4, 1])).toBe('пн, чт')
  })
})

describe('per-unit payments in a plan', () => {
  const account = '00000000-0000-4000-8000-000000000001'
  const input = (payment: Record<string, unknown>) => ({
    expectedVersion: 1,
    plan: {
      month: '2026-10', incomes: [], allocations: [],
      accounts: [{ id: account, name: 'Main', kind: 'current', openingBalance: 0, canFundTransfers: true, priority: 1 }],
      payments: [{ id: '00000000-0000-4000-8000-000000000002', name: 'Pool', accountId: account, due: 'в течение месяца', enabled: true, category: '', ...payment }],
    },
  })

  it('accepts amount equal to unit price × quantity', () => {
    expect(planInput.safeParse(input({ amount: 63_000, unitPrice: 7_000, quantity: 9 })).success).toBe(true)
  })

  it('rejects a mismatched amount or a missing quantity', () => {
    expect(planInput.safeParse(input({ amount: 60_000, unitPrice: 7_000, quantity: 9 })).success).toBe(false)
    expect(planInput.safeParse(input({ amount: 7_000, unitPrice: 7_000 })).success).toBe(false)
  })
})
