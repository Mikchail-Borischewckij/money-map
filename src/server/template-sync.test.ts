import { describe, expect, it } from 'vitest'
import type { MoneyIncome, MoneyPayment } from './money'
import { applyTemplateChanges, templateChanges, type IncomeTemplate, type PaymentTemplate } from './template-sync'

const month = '2026-10'
const rent: PaymentTemplate = { id: 'rent', name: 'Аренда', category: 'Дом', accountId: 'main', amount: 300000, day: 10, schedule: 'monthly', weekdays: null }
const pool: PaymentTemplate = { id: 'pool', name: 'Бассейн', category: 'Дети', accountId: 'main', amount: 7000, day: null, schedule: 'weekly', weekdays: [1, 4] }
const salary: IncomeTemplate = { id: 'salary', name: 'Зарплата', accountId: 'main', amount: 900000, day: 5 }
const rentRow: MoneyPayment = { id: 'p1', recurringPaymentId: 'rent', name: 'Аренда', category: 'Дом', accountId: 'main', amount: 300000, due: '2026-10-10', enabled: true, schedule: 'monthly', weekdays: null, unitPrice: null, quantity: null, exclusionReason: '' }
const poolRow: MoneyPayment = { id: 'p2', recurringPaymentId: 'pool', name: 'Бассейн', category: 'Дети', accountId: 'main', amount: 63000, due: 'в течение месяца', enabled: true, schedule: 'weekly', weekdays: [1, 4], unitPrice: 7000, quantity: 9, exclusionReason: '' }
const salaryRow: MoneyIncome = { id: 'i1', recurringIncomeId: 'salary', name: 'Зарплата', amount: 900000, accountId: 'main', expectedOn: '2026-10-05', enabled: true, status: 'expected' }
const ids = () => { let next = 0; return () => `new-${++next}` }

describe('update from directory', () => {
  it('reports nothing when the month matches the directory', () => {
    expect(templateChanges(month, { payments: [rentRow, poolRow], incomes: [salaryRow] }, { payments: [rent, pool], incomes: [salary] })).toEqual([])
  })

  it('offers templates added after the month was created', () => {
    const changes = templateChanges(month, { payments: [rentRow], incomes: [] }, { payments: [rent, pool], incomes: [salary] }, ids())
    expect(changes.map((change) => [change.kind, change.type, change.name])).toEqual([['payment', 'add', 'Бассейн'], ['income', 'add', 'Зарплата']])
    expect(changes[0].type === 'add' && changes[0].after).toMatchObject({ id: 'new-1', recurringPaymentId: 'pool', unitPrice: 7000, quantity: 9, amount: 63000, enabled: true })
  })

  it('shows a new price and keeps a manually corrected count', () => {
    const changes = templateChanges(month, { payments: [{ ...poolRow, quantity: 6, amount: 42000 }], incomes: [] }, { payments: [{ ...pool, amount: 8000 }], incomes: [] })
    expect(changes).toHaveLength(1)
    const change = changes[0]
    expect(change.type === 'update' && change.fields.map((field) => [field.label, field.before, field.after])).toEqual([['Цена за раз', 7000, 8000], ['Сумма', 42000, 48000]])
    expect(change.type === 'update' && change.after).toMatchObject({ id: 'p2', quantity: 6, amount: 48000 })
  })

  it('recounts occurrences when the weekdays change', () => {
    const [change] = templateChanges(month, { payments: [poolRow], incomes: [] }, { payments: [{ ...pool, weekdays: [2] }], incomes: [] })
    expect(change.type === 'update' && change.after).toMatchObject({ weekdays: [2], quantity: 4, amount: 28000 })
  })

  it('keeps a monthly exclusion while updating values', () => {
    const excluded = { ...rentRow, enabled: false, exclusionReason: 'уже оплачено' }
    const [change] = templateChanges(month, { payments: [excluded], incomes: [] }, { payments: [{ ...rent, amount: 320000 }], incomes: [] })
    expect(change).toMatchObject({ type: 'update', excluded: true, after: { enabled: false, exclusionReason: 'уже оплачено', amount: 320000 } })
  })

  it('offers removal of ended templates and never touches one-off rows', () => {
    const oneOff: MoneyPayment = { id: 'x', name: 'Подарок', category: '', accountId: 'main', amount: 10000, due: 'в течение месяца', enabled: true }
    const changes = templateChanges(month, { payments: [rentRow, oneOff], incomes: [salaryRow] }, { payments: [], incomes: [] })
    expect(changes.map((change) => [change.type, change.key])).toEqual([['remove', 'payment:p1'], ['remove', 'income:i1']])
  })

  it('updates income values but keeps its received status', () => {
    const [change] = templateChanges(month, { payments: [], incomes: [{ ...salaryRow, status: 'included' }] }, { payments: [], incomes: [{ ...salary, amount: 950000, day: 31 }] })
    expect(change.type === 'update' && change.after).toMatchObject({ amount: 950000, expectedOn: '2026-10-31', status: 'included' })
  })
})

describe('applying directory changes', () => {
  it('applies only the chosen items', () => {
    const plan = { payments: [rentRow, poolRow], incomes: [salaryRow] }
    const changes = templateChanges(month, plan, { payments: [{ ...rent, amount: 320000 }, { ...pool, id: 'art', name: 'Рисование' }], incomes: [] }, ids())
    expect(changes.map((change) => change.key)).toEqual(['payment:p1', 'payment:p2', 'payment-template:art', 'income:i1'])
    const next = applyTemplateChanges(plan, changes.filter((change) => change.key !== 'payment:p2'))
    expect(next.payments.map((payment) => [payment.id, payment.amount])).toEqual([['p1', 320000], ['p2', 63000], ['new-1', 63000]])
    expect(next.incomes).toEqual([])
  })
})
