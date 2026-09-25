import { toApiPlan, toUiSummary } from './api-client'
import { calculateMoneyPlan } from '../server/money'

export type AccountKind = 'current' | 'savings' | 'cash' | 'business'

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
  // Business accounts: where everything above payments and the reserve goes, and the reserve itself.
  sweepToAccountId?: string | null
  keepAmount?: number
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
  // Set while the amount is still the estimate from settings for an income whose amount changes monthly.
  amountPending?: boolean
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
  // Set while the amount is still the estimate from settings for a payment whose amount changes monthly.
  amountPending?: boolean
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
  // The day of the month the period starts on; 1 means the calendar month.
  startDay?: number
  // The date the balances are entered on: earlier payments and incomes are already in them.
  balancesOn?: string | null
  accounts: Account[]
  incomes: Income[]
  payments: Payment[]
  allocations: Allocation[]
}

export type AccountSummary = Account & {
  expectedIncome: number
  payments: number
  allocations: number
  keep: number
  available: number
  needed: number
  gap: number
  surplus: number
  incoming: number
  outgoing: number
  remaining: number
}

export type Transfer = {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  kind: 'sweep' | 'cover'
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
  totalKeep: number
  freeAfterPlan: number
  uncovered: number
}

// A regular income or payment with a changing amount still carries the settings estimate until someone checks it.
export const amountToCheck = (item: Income | Payment) => Boolean(item.amountPending) && item.enabled && (!('status' in item) || item.status === 'expected')

export const isBusiness = (account: Pick<Account, 'kind'>) => account.kind === 'business'

// The same calculation as on the server, in grosz, so the screen and the saved month always agree.
export const calculatePlan = (plan: Plan): PlanSummary => toUiSummary(calculateMoneyPlan(toApiPlan(plan)))
