// Incomes and expenses over one or more months, in PLN and dollars. Amounts are in grosz and US cents.

export type SummaryLine = { category: string; name: string; amount: number }
export type SummaryMonth = {
  id: string
  month: string
  startDay: number
  open: boolean
  // PLN per dollar: the NBP rate kept when the month was closed, today's rate for the open month.
  rate: number | null
  rateDate: string | null
  incomes: SummaryLine[]
  payments: SummaryLine[]
  savings: number
}

// `usd` is null when a month in the range has no rate yet.
export type Amounts = { pln: number; usd: number | null }
export type SummaryItem = { name: string; total: Amounts }
export type SummaryGroup = SummaryItem & { items: SummaryItem[] }
export type Summary = {
  months: number
  incomeGroups: SummaryGroup[]
  expenseGroups: SummaryGroup[]
  income: Amounts
  expenses: Amounts
  // Incomes minus expenses, as in the owner's spreadsheet: balances carried over are not part of it.
  result: Amounts
  savings: Amounts
  free: Amounts
}

export const noCategory = 'Без категории'

const toUsd = (grosz: number, rate: number | null) => rate ? Math.round(grosz / rate) : null
const add = (a: Amounts, b: Amounts): Amounts => ({ pln: a.pln + b.pln, usd: a.usd === null || b.usd === null ? null : a.usd + b.usd })
const minus = (a: Amounts, b: Amounts): Amounts => ({ pln: a.pln - b.pln, usd: a.usd === null || b.usd === null ? null : a.usd - b.usd })
const zero: Amounts = { pln: 0, usd: 0 }
const amounts = (grosz: number, rate: number | null): Amounts => ({ pln: grosz, usd: toUsd(grosz, rate) })

// Each month is converted with its own rate, then the months are added up.
function groups(months: SummaryMonth[], lines: (month: SummaryMonth) => SummaryLine[]): SummaryGroup[] {
  const byCategory = new Map<string, Map<string, Amounts>>()
  for (const month of months) {
    for (const line of lines(month)) {
      const category = line.category.trim() || noCategory
      const items = byCategory.get(category) ?? new Map<string, Amounts>()
      items.set(line.name, add(items.get(line.name) ?? zero, amounts(line.amount, month.rate)))
      byCategory.set(category, items)
    }
  }
  const bigFirst = (a: SummaryItem, b: SummaryItem) => b.total.pln - a.total.pln || a.name.localeCompare(b.name, 'ru')
  return [...byCategory].map(([name, items]): SummaryGroup => {
    const list = [...items].map(([item, total]) => ({ name: item, total })).sort(bigFirst)
    return { name, total: list.reduce((sum, item) => add(sum, item.total), zero), items: list }
  }).sort((a, b) => Number(a.name === noCategory) - Number(b.name === noCategory) || bigFirst(a, b))
}

export function summarize(months: SummaryMonth[]): Summary {
  const incomeGroups = groups(months, (month) => month.incomes)
  const expenseGroups = groups(months, (month) => month.payments)
  const total = (list: SummaryGroup[]) => list.reduce((sum, group) => add(sum, group.total), zero)
  const income = total(incomeGroups)
  const expenses = total(expenseGroups)
  const savings = months.reduce((sum, month) => add(sum, amounts(month.savings, month.rate)), zero)
  const result = minus(income, expenses)
  return { months: months.length, incomeGroups, expenseGroups, income, expenses, result, savings, free: minus(result, savings) }
}

// A per-month average of a total over several months.
export const perMonth = (value: Amounts, months: number): Amounts => months > 1
  ? { pln: Math.round(value.pln / months), usd: value.usd === null ? null : Math.round(value.usd / months) }
  : value
