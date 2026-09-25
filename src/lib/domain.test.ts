import { describe, expect, it } from 'vitest'
import { calculatePlan } from './domain'
import { demoPlan } from './demo-plan'

describe('calculatePlan', () => {
  it('matches the reference monthly plan', () => {
    const summary = calculatePlan(demoPlan)

    expect(summary.totalPayments).toBe(7800)
    expect(summary.freeAfterPlan).toBe(2000)
    expect(summary.transfers.reduce((total, transfer) => total + transfer.amount, 0)).toBe(7000)
    expect(summary.uncovered).toBe(0)
  })

  it('does not count income that is already included in an opening balance', () => {
    const plan = structuredClone(demoPlan)
    plan.incomes[1].status = 'included'
    const summary = calculatePlan(plan)

    expect(summary.totalIncome).toBe(12000)
    expect(summary.freeAfterPlan).toBe(1000)
  })

  it('stays preliminary while a changing income amount is not checked', () => {
    const plan = structuredClone(demoPlan)
    plan.accounts.forEach((account) => { account.balanceConfirmed = true })
    expect(calculatePlan(plan).isPreliminary).toBe(false)
    plan.incomes[0].amountPending = true
    expect(calculatePlan(plan).isPreliminary).toBe(true)
    plan.incomes[0].status = 'included'
    expect(calculatePlan(plan).isPreliminary).toBe(false)
  })

  it('reports an uncovered gap when approved sources cannot fund it', () => {
    const plan = structuredClone(demoPlan)
    plan.accounts[0].openingBalance = 0
    plan.incomes = []
    const summary = calculatePlan(plan)

    expect(summary.uncovered).toBeGreaterThan(0)
    expect(summary.transfers).toHaveLength(0)
  })
})

describe('period', () => {
  it('puts days before the start day into the next month and counts weekdays across both', async () => {
    const { dayInPeriod, countWeekdaysInPeriod, periodEnd, periodOf } = await import('./period')
    const period = { month: '2026-09', startDay: 15 }
    expect(dayInPeriod(period, 20)).toBe('2026-09-20')
    expect(dayInPeriod(period, 5)).toBe('2026-10-05')
    expect(dayInPeriod({ month: '2027-01', startDay: 15 }, 31)).toBe('2027-01-31')
    expect(dayInPeriod({ month: '2027-01', startDay: 15 }, 30)).toBe('2027-01-30')
    expect(dayInPeriod({ month: '2027-01', startDay: 15 }, 10)).toBe('2027-02-10')
    expect(periodEnd(period)).toBe('2026-10-14')
    expect(periodEnd({ month: '2026-12', startDay: 15 })).toBe('2027-01-14')
    // 15 Sep – 14 Oct 2026: Mondays 21, 28, 5, 12 and Thursdays 17, 24, 1, 8.
    expect(countWeekdaysInPeriod(period, [1, 4])).toBe(8)
    expect(periodOf('2026-09-25', 15)).toEqual(period)
    expect(periodOf('2026-10-03', 15)).toEqual(period)
    expect(periodOf('2026-01-03', 15)).toEqual({ month: '2025-12', startDay: 15 })
  })
})
