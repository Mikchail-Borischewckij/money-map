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
