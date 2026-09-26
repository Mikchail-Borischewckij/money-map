import { describe, expect, it } from 'vitest'
import { demoPlan } from '../lib/demo-plan'
import { toApiPlan } from '../lib/api-client'
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

describe('business account', () => {
  const plan = (): MoneyPlan => ({
    month: '2026-10',
    accounts: [
      { id: 'business', name: 'Бизнес', kind: 'business', openingBalance: 1_500_000, canFundTransfers: false, priority: 1, sweepToAccountId: 'personal', keepAmount: 50_000 },
      { id: 'personal', name: 'Личный', kind: 'current', openingBalance: 0, canFundTransfers: true, priority: 2 },
      { id: 'bills', name: 'Платежи', kind: 'current', openingBalance: 0, canFundTransfers: false, priority: 3 },
    ],
    incomes: [],
    payments: [
      { id: 'tax', name: 'Налоги', amount: 320_000, accountId: 'business', due: '', enabled: true, category: '' },
      { id: 'accountant', name: 'Бухгалтер', amount: 40_000, accountId: 'business', due: '', enabled: true, category: '' },
      { id: 'rent', name: 'Аренда', amount: 350_000, accountId: 'bills', due: '', enabled: true, category: '' },
    ],
    allocations: [],
  })

  it('sends everything above its payments and reserve to the personal account in one transfer', () => {
    const result = calculateMoneyPlan(plan())
    expect(result.transfers.map(({ fromAccountId, toAccountId, amount, kind }) => [fromAccountId, toAccountId, amount, kind])).toEqual([
      ['business', 'personal', 1_090_000, 'sweep'],
      ['personal', 'bills', 350_000, 'cover'],
    ])
    const business = result.accounts.find((account) => account.id === 'business')!
    expect(business.remaining).toBe(50_000)
    expect(result.accounts.find((account) => account.id === 'personal')!.remaining).toBe(740_000)
    expect(result.freeAfterPlan).toBe(740_000)
  })

  it('never tops up other accounts directly, even when allowed to fund transfers', () => {
    const value = plan()
    value.accounts[0].canFundTransfers = true
    value.accounts[0].sweepToAccountId = null
    const result = calculateMoneyPlan(value)
    expect(result.transfers.some((transfer) => transfer.fromAccountId === 'business')).toBe(false)
    expect(result.uncovered).toBe(350_000)
  })

  it('is topped up from the personal account when its payments exceed what it has', () => {
    const value = plan()
    value.accounts[0].openingBalance = 300_000
    value.accounts[1].openingBalance = 1_000_000
    const result = calculateMoneyPlan(value)
    expect(result.transfers.filter((transfer) => transfer.fromAccountId === 'business')).toHaveLength(0)
    expect(result.transfers.find((transfer) => transfer.toAccountId === 'business')?.amount).toBe(110_000)
  })

  it('keeps a payment with a changing amount preliminary until checked', () => {
    const value = plan()
    value.accounts.forEach((account) => { account.balanceConfirmed = true })
    expect(calculateMoneyPlan(value).isPreliminary).toBe(false)
    value.payments[0].amountPending = true
    expect(calculateMoneyPlan(value).isPreliminary).toBe(true)
    value.payments[0].enabled = false
    expect(calculateMoneyPlan(value).isPreliminary).toBe(false)
  })
  it('never takes money from cash but can top cash up', () => {
    const plan: MoneyPlan = { month: '2026-09', incomes: [], allocations: [], accounts: [
      { id: 'cash', name: 'Наличные', kind: 'cash', openingBalance: 50_000, canFundTransfers: true, priority: 1 },
      { id: 'main', name: 'Основной', kind: 'current', openingBalance: 10_000, canFundTransfers: true, priority: 2 },
      { id: 'bills', name: 'Платежи', kind: 'current', openingBalance: 0, canFundTransfers: false, priority: 3 },
    ], payments: [{ id: 'rent', name: 'Аренда', amount: 20_000, accountId: 'bills', due: '', enabled: true, category: '' }] }
    const result = calculateMoneyPlan(plan)
    expect(result.transfers).toEqual([expect.objectContaining({ fromAccountId: 'main', toAccountId: 'bills', amount: 10_000 })])
    expect(result.uncovered).toBe(10_000)
    plan.payments[0].accountId = 'cash'
    plan.payments[0].amount = 60_000
    expect(calculateMoneyPlan(plan).transfers).toEqual([expect.objectContaining({ fromAccountId: 'main', toAccountId: 'cash', amount: 10_000 })])
  })

  it('counts made transfers as made and adds only what is still missing', () => {
    const plan: MoneyPlan = { month: '2026-09', incomes: [], allocations: [], accounts: [
      { id: 'main', name: 'Основной', kind: 'current', openingBalance: 100_000, canFundTransfers: true, priority: 1 },
      { id: 'bills', name: 'Платежи', kind: 'current', openingBalance: 0, canFundTransfers: false, priority: 2 },
    ], payments: [{ id: 'rent', name: 'Аренда', amount: 30_000, accountId: 'bills', due: '', enabled: true, category: '' }],
    doneTransfers: [{ id: 'made', fromAccountId: 'main', toAccountId: 'bills', amount: 28_000 }] }
    const short = calculateMoneyPlan(plan)
    expect(short.transfers).toEqual([
      expect.objectContaining({ id: 'made', amount: 28_000, done: true }),
      expect.objectContaining({ fromAccountId: 'main', toAccountId: 'bills', amount: 2_000, done: false }),
    ])
    plan.payments[0].amount = 25_000
    const extra = calculateMoneyPlan(plan)
    expect(extra.transfers).toEqual([expect.objectContaining({ id: 'made', amount: 28_000, done: true })])
    expect(extra.accounts.find((account) => account.id === 'bills')!.remaining).toBe(3_000)
  })

  it('keeps the amount to keep on any account: tops it up and never takes it', () => {
    const plan: MoneyPlan = { month: '2026-09', incomes: [], allocations: [], accounts: [
      { id: 'main', name: 'Основной', kind: 'current', openingBalance: 10_000, canFundTransfers: true, priority: 1, keepAmount: 2_000 },
      { id: 'card', name: 'Карта', kind: 'current', openingBalance: 0, canFundTransfers: false, priority: 2, keepAmount: 1_000 },
    ], payments: [{ id: 'fee', name: 'Подписка', amount: 5_000, accountId: 'card', due: '', enabled: true, category: '' }] }
    const result = calculateMoneyPlan(plan)
    expect(result.transfers).toEqual([expect.objectContaining({ fromAccountId: 'main', toAccountId: 'card', amount: 6_000 })])
    expect(result.accounts.map((account) => account.remaining)).toEqual([4_000, 1_000])
    expect(result.totalKeep).toBe(3_000)
    expect(result.freeAfterPlan).toBe(10_000 - 5_000 - 3_000)
    plan.accounts[1].keepAmount = 5_000
    expect(calculateMoneyPlan(plan).uncovered).toBe(2_000)
  })
})
