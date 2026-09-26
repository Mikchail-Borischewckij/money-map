import { describe, expect, it } from 'vitest'
import { noCategory, perMonth, summarize, type SummaryMonth } from './summary'
import { nbpRate, rateDayFor } from '../server/usd-rate'

const month = (patch: Partial<SummaryMonth>): SummaryMonth => ({ id: 'm', month: '2026-09', startDay: 1, open: false, rate: 3.8377, rateDate: '2026-09-30', incomes: [], payments: [], savings: 0, ...patch })

describe('summary', () => {
  it('matches the spreadsheet: incomes by category, expenses, and what is left, in PLN and dollars', () => {
    const summary = summarize([month({
      incomes: [{ category: 'Зарплата', name: 'Зарплата Миши', amount: 1500000 }, { category: 'Зарплата', name: 'Зарплата жены', amount: 667003 }, { category: '800+ и пособия', name: '800+', amount: 160000 }],
      payments: [{ category: 'Жильё', name: 'Аренда', amount: 800000 }, { category: '', name: 'Разное', amount: 228400 }],
    })])
    expect(summary.incomeGroups.map((group) => [group.name, group.total.pln])).toEqual([['Зарплата', 2167003], ['800+ и пособия', 160000]])
    expect(summary.incomeGroups[0].items.map((item) => item.name)).toEqual(['Зарплата Миши', 'Зарплата жены'])
    expect(summary.income).toEqual({ pln: 2327003, usd: 390859 + 173803 + 41692 })
    expect(summary.expenses.pln).toBe(1028400)
    expect(summary.expenseGroups.at(-1)?.name).toBe(noCategory)
    expect(summary.result.pln).toBe(1298603)
    expect(summary.result.usd).toBe(summary.income.usd! - summary.expenses.usd!)
  })

  it('converts each month with its own rate and adds the same item up across months', () => {
    const summary = summarize([
      month({ id: 'a', rate: 4, incomes: [{ category: 'Зарплата', name: 'Зарплата', amount: 400000 }], savings: 40000 }),
      month({ id: 'b', month: '2026-10', rate: 5, incomes: [{ category: 'Зарплата', name: 'Зарплата', amount: 500000 }] }),
    ])
    expect(summary.incomeGroups[0].items).toEqual([{ name: 'Зарплата', total: { pln: 900000, usd: 200000 } }])
    expect(summary.savings).toEqual({ pln: 40000, usd: 10000 })
    expect(summary.free).toEqual({ pln: 860000, usd: 190000 })
    expect(perMonth(summary.income, summary.months)).toEqual({ pln: 450000, usd: 100000 })
  })

  it('shows no dollars when a month has no rate', () => {
    const summary = summarize([month({ rate: null, incomes: [{ category: 'Зарплата', name: 'Зарплата', amount: 100 }] }), month({ id: 'b', incomes: [{ category: 'Зарплата', name: 'Зарплата', amount: 100 }] })])
    expect(summary.income).toEqual({ pln: 200, usd: null })
    expect(summary.result.usd).toBeNull()
  })
})

describe('NBP rate', () => {
  it('takes the last rate on or before the day', async () => {
    let url = ''
    const fetcher = (async (input: string) => { url = input; return Response.json({ rates: [{ effectiveDate: '2026-09-25', mid: 3.8404 }, { effectiveDate: '2026-09-26', mid: 3.85 }] }) }) as unknown as typeof fetch
    expect(await nbpRate('2026-09-27', fetcher)).toEqual({ rate: 3.85, date: '2026-09-26' })
    expect(url).toBe('https://api.nbp.pl/api/exchangerates/rates/a/usd/2026-09-17/2026-09-27/?format=json')
  })

  it('gives null when NBP fails', async () => {
    expect(await nbpRate('2026-09-27', (async () => new Response('', { status: 404 })) as unknown as typeof fetch)).toBeNull()
    expect(await nbpRate('2026-09-27', (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toBeNull()
  })

  it('uses the last day of the period, or today while it is still running', () => {
    expect(rateDayFor('2026-08', 15, '2026-09-26')).toBe('2026-09-14')
    expect(rateDayFor('2026-09', 15, '2026-09-26')).toBe('2026-09-26')
  })
})
