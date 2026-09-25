export type MoneyAccount = { id: string; name: string; kind: string; openingBalance: number; balanceConfirmed?: boolean; balanceDate?: string | null; canFundTransfers: boolean; priority: number; version?: number; isArchived?: boolean }
export type MoneyIncome = { id: string; name: string; amount: number; accountId: string; expectedOn: string; enabled: boolean; status: 'expected' | 'included' | 'excluded'; recurringIncomeId?: string | null; amountPending?: boolean }
export type MoneyPayment = { id: string; name: string; amount: number; accountId: string; due: string; enabled: boolean; category: string; recurringPaymentId?: string | null; schedule?: 'monthly' | 'weekly' | null; weekdays?: number[] | null; unitPrice?: number | null; quantity?: number | null; exclusionReason?: string }
export type MoneyAllocation = { id: string; name: string; amount: number; accountId: string; kind: 'living' | 'savings' | 'other' }
export type MoneyPlan = { month: string; accounts: MoneyAccount[]; incomes: MoneyIncome[]; payments: MoneyPayment[]; allocations: MoneyAllocation[] }

const cents = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 9_000_000_000_000) throw new Error('Invalid money amount')
  return BigInt(value)
}
const safeNumber = (value: bigint) => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Money total is too large')
  return Number(value)
}

// A regular income with a changing amount still carries the settings estimate until someone checks it.
export const amountToCheck = (income: MoneyIncome) => Boolean(income.amountPending) && income.enabled && income.status === 'expected'

export function calculateMoneyPlan(plan: MoneyPlan) {
  const accounts = plan.accounts.map((account) => {
    const opening = cents(account.openingBalance)
    const expectedIncome = plan.incomes.filter((income) => income.enabled && income.status === 'expected' && income.accountId === account.id).reduce((sum, income) => sum + cents(income.amount), 0n)
    const payments = plan.payments.filter((payment) => payment.enabled && payment.accountId === account.id).reduce((sum, payment) => sum + cents(payment.amount), 0n)
    const allocations = plan.allocations.filter((allocation) => allocation.accountId === account.id).reduce((sum, allocation) => sum + cents(allocation.amount), 0n)
    const available = opening + expectedIncome
    const needed = payments + allocations
    return { ...account, expectedIncome: safeNumber(expectedIncome), payments: safeNumber(payments), allocations: safeNumber(allocations), available: safeNumber(available), needed: safeNumber(needed), gap: safeNumber(needed > available ? needed - available : 0n), surplus: safeNumber(available > needed ? available - needed : 0n) }
  })
  const sources = accounts.filter((account) => account.canFundTransfers && account.surplus > 0).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).map((account) => ({ id: account.id, remaining: BigInt(account.surplus) }))
  const targets = accounts.filter((account) => account.gap > 0).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).map((account) => ({ id: account.id, remaining: BigInt(account.gap) }))
  const transfers: { id: string; fromAccountId: string; toAccountId: string; amount: number }[] = []
  for (const target of targets) {
    for (const source of sources) {
      if (target.remaining === 0n) break
      if (source.remaining === 0n || source.id === target.id) continue
      const amount = source.remaining < target.remaining ? source.remaining : target.remaining
      transfers.push({ id: `${source.id}-${target.id}`, fromAccountId: source.id, toAccountId: target.id, amount: safeNumber(amount) })
      source.remaining -= amount
      target.remaining -= amount
    }
  }
  const total = (values: number[]) => values.reduce((sum, value) => sum + BigInt(value), 0n)
  const totalIncome = total(plan.incomes.filter((income) => income.enabled && income.status === 'expected').map((income) => cents(income.amount)).map(safeNumber))
  const totalPayments = total(plan.payments.filter((payment) => payment.enabled).map((payment) => cents(payment.amount)).map(safeNumber))
  const totalLiving = total(plan.allocations.filter((allocation) => allocation.kind === 'living').map((allocation) => cents(allocation.amount)).map(safeNumber))
  const totalSavings = total(plan.allocations.filter((allocation) => allocation.kind === 'savings').map((allocation) => cents(allocation.amount)).map(safeNumber))
  const totalOther = total(plan.allocations.filter((allocation) => allocation.kind === 'other').map((allocation) => cents(allocation.amount)).map(safeNumber))
  const totalAvailable = total(accounts.map((account) => account.available))
  return {
    accounts, transfers,
    isPreliminary: accounts.length === 0 || accounts.some((account) => !account.balanceConfirmed) || plan.incomes.some(amountToCheck),
    totalAvailable: safeNumber(totalAvailable), totalIncome: safeNumber(totalIncome),
    totalPayments: safeNumber(totalPayments), totalLiving: safeNumber(totalLiving),
    totalSavings: safeNumber(totalSavings), totalOther: safeNumber(totalOther),
    freeAfterPlan: safeNumber(totalAvailable - totalPayments - totalLiving - totalSavings - totalOther),
    uncovered: safeNumber(targets.reduce((sum, target) => sum + target.remaining, 0n)),
  }
}
