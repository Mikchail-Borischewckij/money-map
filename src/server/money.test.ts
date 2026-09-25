import { describe, expect, it } from 'vitest'
import { demoPlan } from '../demo-plan'
import { toApiPlan } from '../api-client'
import { calculateMoneyPlan, type MoneyPlan } from './money'

const example = () => structuredClone(toApiPlan(demoPlan))

describe('server money calculation in grosz', () => {
  it('matches the reference plan without counting transfers as spending', () => {
    const result = calculateMoneyPlan(example())
    expect(result.totalPayments).toBe(780_000)
    expect(result.transfers.reduce((sum, transfer) => sum + transfer.amount, 0)).toBe(700_000)
    expect(result.freeAfterPlan).toBe(200_000)
  })

  it('excludes disabled and already included income', () => {
    const disabled = example()
    disabled.incomes[1].enabled = false
    expect(calculateMoneyPlan(disabled).totalAvailable).toBe(calculateMoneyPlan(example()).totalAvailable - 100_000)
    disabled.incomes[1].enabled = true
    disabled.incomes[1].status = 'included'
    expect(calculateMoneyPlan(disabled).totalAvailable).toBe(calculateMoneyPlan(example()).totalAvailable - 100_000)
  })

  it('excludes a disabled payment and reports shortage', () => {
    const plan = example()
    plan.payments[0].enabled = false
    expect(calculateMoneyPlan(plan).totalPayments).toBe(480_000)
    plan.incomes = []
    expect(calculateMoneyPlan(plan).freeAfterPlan).toBeLessThan(0)
  })

  it('uses source priority and reports gaps that permitted sources cannot cover', () => {
    const plan: MoneyPlan = {
      month: '2026-10',
      accounts: [
        { id: 'first', name: 'First', kind: 'current', openingBalance: 40000, canFundTransfers: true, priority: 1 },
        { id: 'second', name: 'Second', kind: 'current', openingBalance: 30000, canFundTransfers: true, priority: 2 },
        { id: 'target', name: 'Target', kind: 'current', openingBalance: 0, canFundTransfers: false, priority: 3 },
      ],
      incomes: [], payments: [{ id: 'p', name: 'Payment', amount: 60000, accountId: 'target', due: '', enabled: true, category: '' }], allocations: [],
    }
    const result = calculateMoneyPlan(plan)
    expect(result.transfers.map((transfer) => transfer.amount)).toEqual([40000, 20000])
    expect(result.uncovered).toBe(0)
    plan.accounts[1].canFundTransfers = false
    expect(calculateMoneyPlan(plan).uncovered).toBe(20000)
  })

  it('adds decimal amounts exactly after conversion to grosz', () => {
    const plan = example()
    plan.accounts = [{ id: 'a', name: 'A', kind: 'cash', openingBalance: 10, canFundTransfers: true, priority: 1 }]
    plan.incomes = [{ id: 'i', name: 'Income', amount: 20, accountId: 'a', expectedOn: '', enabled: true, status: 'expected' }]
    plan.payments = []
    plan.allocations = []
    expect(calculateMoneyPlan(plan).totalAvailable).toBe(30)
  })
})
