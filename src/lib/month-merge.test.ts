import { describe, expect, it } from 'vitest'
import type { MoneyIncome } from '../server/money'
import { mergeIncome, mergePayment, paymentFromTemplate, type IncomeTemplate, type PaymentTemplate } from './month-merge'

const month = { month: '2026-10', startDay: 1 }
const rent: PaymentTemplate = { id: 'rent', name: 'Аренда', category: 'Жильё', accountId: 'main', amount: 350000, day: 10, schedule: 'monthly', weekdays: null }
const pool: PaymentTemplate = { id: 'pool', name: 'Бассейн', category: 'Спорт', accountId: 'main', amount: 7000, day: null, schedule: 'weekly', weekdays: [1, 4] }
const salary: IncomeTemplate = { id: 'salary', name: 'Зарплата', accountId: 'main', amount: 900000, day: 10, varies: false }
const salaryRow: MoneyIncome = { id: 'i1', recurringIncomeId: 'salary', name: 'Зарплата', amount: 900000, accountId: 'main', expectedOn: '2026-10-10', enabled: true, status: 'expected' }

describe('settings changes in the open month', () => {
  it('adds a new payment with the calendar count', () => {
    const { value, kept } = mergePayment(month, null, null, pool, () => 'new')
    expect(value).toMatchObject({ id: 'new', recurringPaymentId: 'pool', quantity: 9, amount: 63000, enabled: true })
    expect(kept).toEqual([])
  })

  it('follows a new price while the month still has the old one', () => {
    const row = paymentFromTemplate(month, rent, 'p1')
    const { value, kept } = mergePayment(month, row, rent, { ...rent, amount: 370000, accountId: 'second' })
    expect(value).toMatchObject({ id: 'p1', amount: 370000, accountId: 'second' })
    expect(kept).toEqual([])
  })

  it('keeps an amount changed in the month and still takes the other fields', () => {
    const row = { ...paymentFromTemplate(month, rent, 'p1'), amount: 300000 }
    const { value, kept } = mergePayment(month, row, rent, { ...rent, amount: 370000, accountId: 'second' })
    expect(value).toMatchObject({ amount: 300000, accountId: 'second' })
    expect(kept).toEqual(['сумма'])
  })

  it('keeps a corrected count, takes a new price and recomputes the total', () => {
    const row = { ...paymentFromTemplate(month, pool, 'p2'), quantity: 6, amount: 42000 }
    const { value, kept } = mergePayment(month, row, pool, { ...pool, amount: 8000 })
    expect(value).toMatchObject({ quantity: 6, unitPrice: 8000, amount: 48000 })
    expect(kept).toEqual(['количество'])
  })

  it('recounts when the weekdays change', () => {
    const row = { ...paymentFromTemplate(month, pool, 'p2'), quantity: 6, amount: 42000 }
    const { value } = mergePayment(month, row, pool, { ...pool, weekdays: [2] })
    expect(value).toMatchObject({ weekdays: [2], quantity: 4, amount: 28000 })
  })

  it('keeps an exclusion and its reason', () => {
    const row = { ...paymentFromTemplate(month, rent, 'p1'), enabled: false, exclusionReason: 'уже оплачено' }
    const { value } = mergePayment(month, row, rent, { ...rent, amount: 370000 })
    expect(value).toMatchObject({ enabled: false, exclusionReason: 'уже оплачено', amount: 370000 })
  })

  it('switches a monthly payment to weekly', () => {
    const row = paymentFromTemplate(month, { ...pool, schedule: 'monthly', weekdays: null, amount: 50000 }, 'p3')
    const { value } = mergePayment(month, row, { ...pool, schedule: 'monthly', weekdays: null, amount: 50000 }, pool)
    expect(value).toMatchObject({ schedule: 'weekly', quantity: 9, unitPrice: 7000, amount: 63000, due: 'в течение месяца' })
  })

  it('updates income but keeps its status and an amount changed in the month', () => {
    const { value, kept } = mergeIncome(month, { ...salaryRow, status: 'included', amount: 950000 }, salary, { ...salary, amount: 1000000, day: 31 })
    expect(value).toMatchObject({ amount: 950000, expectedOn: '2026-10-31', status: 'included' })
    expect(kept).toEqual(['сумма'])
  })

  it('marks a varying income as an estimate in a new month', () => {
    const { value } = mergeIncome(month, null, null, { ...salary, varies: true }, () => 'i2')
    expect(value).toMatchObject({ id: 'i2', amount: 900000, amountPending: true })
  })

  it('marks the open month when settings start saying the amount varies, unless the amount was set in the month', () => {
    expect(mergeIncome(month, salaryRow, salary, { ...salary, varies: true }).value.amountPending).toBe(true)
    expect(mergeIncome(month, { ...salaryRow, amount: 950000 }, salary, { ...salary, varies: true }).value.amountPending).toBe(false)
    expect(mergeIncome(month, { ...salaryRow, status: 'included' }, salary, { ...salary, varies: true }).value.amountPending).toBe(false)
  })

  it('keeps a checked amount checked and drops the mark when the amount no longer varies', () => {
    const varying = { ...salary, varies: true }
    expect(mergeIncome(month, { ...salaryRow, amountPending: false }, varying, { ...varying, day: 12 }).value.amountPending).toBe(false)
    expect(mergeIncome(month, { ...salaryRow, amountPending: true }, varying, { ...varying, amount: 800000 }).value).toMatchObject({ amount: 800000, amountPending: true })
    expect(mergeIncome(month, { ...salaryRow, amountPending: true }, varying, salary).value.amountPending).toBe(false)
  })
})

describe('moving the open month to another start day', () => {
  const shifted = { month: '2026-10', startDay: 15 }
  it('moves dates and weekday counts that still follow settings', () => {
    expect(mergePayment(shifted, paymentFromTemplate(month, rent, 'p1'), rent, rent, undefined, month).value.due).toBe('2026-11-10')
    // 15 Oct – 14 Nov 2026: Mondays 19, 26, 2, 9 and Thursdays 15, 22, 29, 5, 12.
    expect(mergePayment(shifted, paymentFromTemplate(month, pool, 'p2'), pool, pool, undefined, month).value.quantity).toBe(9)
  })
  it('keeps a count changed in the month', () => {
    const row = { ...paymentFromTemplate(month, pool, 'p2'), quantity: 4, amount: 28000 }
    expect(mergePayment(shifted, row, pool, pool, undefined, month).value.quantity).toBe(4)
  })
  it('keeps a changing amount to check until it is checked', () => {
    const tax = { ...rent, id: 'tax', varies: true }
    const row = paymentFromTemplate(month, tax, 'p3')
    expect(row.amountPending).toBe(true)
    expect(mergePayment(month, { ...row, amountPending: false }, tax, { ...tax, amount: 1 }).value.amountPending).toBe(false)
    expect(mergePayment(month, { ...row, amount: 5 }, tax, { ...tax, amount: 1 }).value).toMatchObject({ amount: 5, amountPending: false })
  })

  it('keeps a checked amount when settings change', () => {
    const row = { ...paymentFromTemplate(month, rent, 'p1'), checked: true }
    const { value, kept } = mergePayment(month, row, rent, { ...rent, amount: 370000 })
    expect(value).toMatchObject({ amount: 350000, checked: true })
    expect(kept).toEqual(['сумма'])
    const weekly = { ...paymentFromTemplate(month, pool, 'p2'), checked: true }
    expect(mergePayment(month, weekly, pool, { ...pool, amount: 8000 }).value).toMatchObject({ amount: weekly.amount, unitPrice: 7000 })
  })
  it('keeps the amount of a checked income when settings change', () => {
    const { value, kept } = mergeIncome(month, { ...salaryRow, checked: true }, salary, { ...salary, amount: 1000000, varies: true })
    expect(value).toMatchObject({ amount: 900000, checked: true, amountPending: false })
    expect(kept).toEqual(['сумма'])
  })
})
