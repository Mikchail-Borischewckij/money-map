export type AccountKind = 'current' | 'savings' | 'cash'

export type Account = {
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
  balanceConfirmed?: boolean
  balanceDate?: string | null
  canFundTransfers: boolean
  priority: number
  version?: number
  isArchived?: boolean
}

export type Income = {
  id: string
  name: string
  amount: number
  accountId: string
  expectedOn: string
  enabled: boolean
  status: 'expected' | 'included' | 'excluded'
  recurringIncomeId?: string | null
}

export type Payment = {
  id: string
  name: string
  amount: number
  accountId: string
  due: string
  enabled: boolean
  category: string
  recurringPaymentId?: string | null
  schedule?: 'monthly' | 'weekly' | null
  weekdays?: number[] | null
  unitPrice?: number | null
  quantity?: number | null
  exclusionReason?: string
}

export type Allocation = {
  id: string
  name: string
  amount: number
  accountId: string
  kind: 'living' | 'savings' | 'other'
}

export type Plan = {
  month: string
  accounts: Account[]
  incomes: Income[]
  payments: Payment[]
  allocations: Allocation[]
}

export type AccountSummary = Account & {
  expectedIncome: number
  payments: number
  allocations: number
  available: number
  needed: number
  gap: number
  surplus: number
}

export type Transfer = {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
}

export type PlanSummary = {
  accounts: AccountSummary[]
  transfers: Transfer[]
  isPreliminary?: boolean
  totalAvailable: number
  totalIncome: number
  totalPayments: number
  totalLiving: number
  totalSavings: number
  totalOther: number
  freeAfterPlan: number
  uncovered: number
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export function calculatePlan(plan: Plan): PlanSummary {
  const summaries: AccountSummary[] = plan.accounts.map((account) => {
    const expectedIncome = sum(
      plan.incomes
        .filter((income) => income.enabled && income.status === 'expected' && income.accountId === account.id)
        .map((income) => income.amount),
    )
    const payments = sum(
      plan.payments
        .filter((payment) => payment.enabled && payment.accountId === account.id)
        .map((payment) => payment.amount),
    )
    const allocations = sum(
      plan.allocations
        .filter((allocation) => allocation.accountId === account.id)
        .map((allocation) => allocation.amount),
    )
    const available = account.openingBalance + expectedIncome
    const needed = payments + allocations

    return {
      ...account,
      expectedIncome,
      payments,
      allocations,
      available,
      needed,
      gap: Math.max(0, needed - available),
      surplus: Math.max(0, available - needed),
    }
  })

  const sources = summaries
    .filter((account) => account.canFundTransfers && account.surplus > 0)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .map((account) => ({ id: account.id, remaining: account.surplus }))

  const targets = summaries
    .filter((account) => account.gap > 0)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .map((account) => ({ id: account.id, remaining: account.gap }))

  const transfers: Transfer[] = []
  for (const target of targets) {
    for (const source of sources) {
      if (target.remaining <= 0) break
      if (source.id === target.id || source.remaining <= 0) continue
      const amount = Math.min(source.remaining, target.remaining)
      transfers.push({
        id: `${source.id}-${target.id}`,
        fromAccountId: source.id,
        toAccountId: target.id,
        amount,
      })
      source.remaining -= amount
      target.remaining -= amount
    }
  }

  const totalIncome = sum(
    plan.incomes.filter((income) => income.enabled && income.status === 'expected').map((income) => income.amount),
  )
  const totalPayments = sum(plan.payments.filter((payment) => payment.enabled).map((payment) => payment.amount))
  const totalLiving = sum(plan.allocations.filter((allocation) => allocation.kind === 'living').map((allocation) => allocation.amount))
  const totalSavings = sum(plan.allocations.filter((allocation) => allocation.kind === 'savings').map((allocation) => allocation.amount))
  const totalOther = sum(plan.allocations.filter((allocation) => allocation.kind === 'other').map((allocation) => allocation.amount))
  const totalAvailable = sum(summaries.map((account) => account.available))

  return {
    accounts: summaries,
    transfers,
    isPreliminary: plan.accounts.length === 0 || plan.accounts.some((account) => !account.balanceConfirmed),
    totalAvailable,
    totalIncome,
    totalPayments,
    totalLiving,
    totalSavings,
    totalOther,
    freeAfterPlan: totalAvailable - totalPayments - totalLiving - totalSavings - totalOther,
    uncovered: sum(targets.map((target) => target.remaining)),
  }
}
