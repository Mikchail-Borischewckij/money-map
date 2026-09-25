import type { Account, Plan, PlanSummary } from './domain'
import type { MoneyPlan, calculateMoneyPlan } from './server/money'

export type ServerRecord = {
  id: string
  version: number
  status: 'Draft' | 'Finalized'
  updatedAt: string
  updatedBy: string
  plan: MoneyPlan
  summary: ReturnType<typeof calculateMoneyPlan>
}

const zl = (cents: number) => cents / 100

export function toUiPlan(plan: MoneyPlan): Plan {
  return {
    month: plan.month,
    accounts: plan.accounts.map((account) => ({ ...account, kind: account.kind as Account['kind'], openingBalance: zl(account.openingBalance) })),
    incomes: plan.incomes.map((income) => ({ ...income, amount: zl(income.amount) })),
    payments: plan.payments.map((payment) => ({ ...payment, amount: zl(payment.amount) })),
    allocations: plan.allocations.map((allocation) => ({ ...allocation, amount: zl(allocation.amount) })),
  }
}

export function toUiSummary(summary: ServerRecord['summary']): PlanSummary {
  return {
    ...summary,
    accounts: summary.accounts.map((account) => ({
      ...account, kind: account.kind as Account['kind'],
      openingBalance: zl(account.openingBalance), expectedIncome: zl(account.expectedIncome),
      payments: zl(account.payments), allocations: zl(account.allocations),
      available: zl(account.available), needed: zl(account.needed), gap: zl(account.gap), surplus: zl(account.surplus),
    })),
    transfers: summary.transfers.map((transfer) => ({ ...transfer, amount: zl(transfer.amount) })),
    totalAvailable: zl(summary.totalAvailable), totalIncome: zl(summary.totalIncome),
    totalPayments: zl(summary.totalPayments), totalLiving: zl(summary.totalLiving),
    totalSavings: zl(summary.totalSavings), totalOther: zl(summary.totalOther),
    freeAfterPlan: zl(summary.freeAfterPlan), uncovered: zl(summary.uncovered),
  }
}

export function toCents(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error('Неверная сумма')
  const [whole, fraction = ''] = value.toString().split('.')
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) throw new Error('Используйте не более двух знаков после запятой')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw new Error('Сумма слишком велика')
  return cents
}

export function toApiPlan(plan: Plan): MoneyPlan {
  return {
    month: plan.month,
    accounts: plan.accounts.map((account) => ({ ...account, openingBalance: toCents(account.openingBalance) })),
    incomes: plan.incomes.map((income) => ({ ...income, amount: toCents(income.amount) })),
    payments: plan.payments.map((payment) => ({ ...payment, amount: toCents(payment.amount) })),
    allocations: plan.allocations.map((allocation) => ({ ...allocation, amount: toCents(allocation.amount) })),
  }
}
