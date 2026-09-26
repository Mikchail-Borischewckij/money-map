// `keepAmount`: what must stay on the account this month (a fee, a reserve); it counts like a payment of the account.
// `sweepToAccountId`: a business account sends everything above its own payments and `keepAmount` to this account in one transfer.
export type MoneyAccount = { id: string; name: string; bank?: string; kind: string; openingBalance: number; balanceConfirmed?: boolean; balanceDate?: string | null; canFundTransfers: boolean; priority: number; version?: number; isArchived?: boolean; sweepToAccountId?: string | null; keepAmount?: number }
export type MoneyIncome = { id: string; name: string; amount: number; accountId: string; expectedOn: string; enabled: boolean; status: 'expected' | 'included' | 'excluded'; recurringIncomeId?: string | null; amountPending?: boolean; checked?: boolean; category?: string }
export type MoneyPayment = { id: string; name: string; amount: number; accountId: string; due: string; enabled: boolean; category: string; recurringPaymentId?: string | null; schedule?: 'monthly' | 'weekly' | null; weekdays?: number[] | null; unitPrice?: number | null; quantity?: number | null; exclusionReason?: string; amountPending?: boolean; checked?: boolean }
// A transfer already made this month; it keeps its amount whatever the plan says later.
export type MoneyDoneTransfer = { id: string; fromAccountId: string; toAccountId: string; amount: number }
export type MoneyAllocation = { id: string; name: string; amount: number; accountId: string; kind: 'living' | 'savings' | 'other' }
// `startDay`: the day of the month the period starts on (1 = calendar month). Set by the server.
// `balancesOn`: the date the balances are entered on; weekly items count from it.
export type MoneyPlan = { month: string; startDay?: number; balancesOn?: string | null; accounts: MoneyAccount[]; incomes: MoneyIncome[]; payments: MoneyPayment[]; allocations: MoneyAllocation[]; doneTransfers?: MoneyDoneTransfer[] }

const cents = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 9_000_000_000_000) throw new Error('Invalid money amount')
  return BigInt(value)
}
const safeNumber = (value: bigint) => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Money total is too large')
  return Number(value)
}

// A regular income or payment with a changing amount still carries the settings estimate until someone checks it.
export const amountToCheck = (item: MoneyIncome | MoneyPayment) => Boolean(item.amountPending) && item.enabled && (!('status' in item) || item.status === 'expected')

export const isBusiness = (account: MoneyAccount) => account.kind === 'business'
// Business and cash accounts are never a source for covering other accounts, so they have no place in the transfer order.
export const hasTransferPriority = (account: Pick<MoneyAccount, 'kind'>) => account.kind !== 'business' && account.kind !== 'cash'

// Transfers, in the order to make them:
// 0. Transfers already made count as they were made (`done`); everything below only adds what is still missing.
//    Too much moved is left as it is: the extra stays on the receiving account.
// 1. Each business account sends everything above its payments and reserve to its personal account, in one transfer.
// 2. Accounts that cannot cover their payments are topped up from the accounts allowed to fund transfers, in list order.
//    Business accounts are never used for this: their money reaches other accounts through the personal account.
//    Cash is never a source either; it can still be topped up (a withdrawal).
export function calculateMoneyPlan(plan: MoneyPlan) {
  const ids = new Set(plan.accounts.map((account) => account.id))
  const base = plan.accounts.map((account) => {
    const opening = cents(account.openingBalance)
    const expectedIncome = plan.incomes.filter((income) => income.enabled && income.status === 'expected' && income.accountId === account.id).reduce((sum, income) => sum + cents(income.amount), 0n)
    const payments = plan.payments.filter((payment) => payment.enabled && payment.accountId === account.id).reduce((sum, payment) => sum + cents(payment.amount), 0n)
    const allocations = plan.allocations.filter((allocation) => allocation.accountId === account.id).reduce((sum, allocation) => sum + cents(allocation.amount), 0n)
    const keep = cents(account.keepAmount ?? 0)
    return { account, available: opening + expectedIncome, expectedIncome, payments, allocations, keep, incoming: 0n, outgoing: 0n }
  })
  const byId = new Map(base.map((item) => [item.account.id, item]))
  const transfers: { id: string; fromAccountId: string; toAccountId: string; amount: number; kind: 'sweep' | 'cover' | 'done'; done: boolean }[] = []
  const move = (from: typeof base[number], to: typeof base[number], amount: bigint, kind: 'sweep' | 'cover' | 'done', id = `${from.account.id}-${to.account.id}`) => {
    if (amount <= 0n) return
    from.outgoing += amount
    to.incoming += amount
    transfers.push({ id, fromAccountId: from.account.id, toAccountId: to.account.id, amount: safeNumber(amount), kind, done: kind === 'done' })
  }
  const balance = (item: typeof base[number]) => item.available + item.incoming - item.outgoing - item.payments - item.allocations - item.keep

  for (const made of plan.doneTransfers ?? []) {
    const from = byId.get(made.fromAccountId)
    const to = byId.get(made.toAccountId)
    if (from && to && from !== to) move(from, to, cents(made.amount), 'done', made.id)
  }

  for (const item of base) {
    const target = item.account.sweepToAccountId
    if (!isBusiness(item.account) || !target || target === item.account.id || !ids.has(target)) continue
    move(item, byId.get(target)!, balance(item), 'sweep')
  }

  const ordered = [...base].sort((a, b) => a.account.priority - b.account.priority || a.account.id.localeCompare(b.account.id))
  const targets = ordered.filter((item) => balance(item) < 0n).map((item) => ({ item, remaining: -balance(item) }))
  const sources = ordered.filter((item) => item.account.canFundTransfers && hasTransferPriority(item.account) && balance(item) > 0n)
  for (const target of targets) {
    for (const source of sources) {
      if (target.remaining === 0n) break
      if (source === target.item) continue
      const spare = balance(source)
      if (spare <= 0n) continue
      const amount = spare < target.remaining ? spare : target.remaining
      move(source, target.item, amount, 'cover')
      target.remaining -= amount
    }
  }

  const accounts = base.map((item) => {
    const needed = item.payments + item.allocations + item.keep
    return {
      ...item.account,
      expectedIncome: safeNumber(item.expectedIncome), payments: safeNumber(item.payments), allocations: safeNumber(item.allocations), keep: safeNumber(item.keep),
      available: safeNumber(item.available), needed: safeNumber(needed),
      gap: safeNumber(needed > item.available ? needed - item.available : 0n), surplus: safeNumber(item.available > needed ? item.available - needed : 0n),
      incoming: safeNumber(item.incoming), outgoing: safeNumber(item.outgoing),
      // What stays on the account after this period's payments, savings and transfers (the amount to keep included).
      remaining: safeNumber(item.available + item.incoming - item.outgoing - item.payments - item.allocations),
    }
  })
  const sumOf = (values: bigint[]) => values.reduce((sum, value) => sum + value, 0n)
  const allocationsOf = (kind: MoneyAllocation['kind']) => sumOf(plan.allocations.filter((allocation) => allocation.kind === kind).map((allocation) => cents(allocation.amount)))
  const totalIncome = sumOf(plan.incomes.filter((income) => income.enabled && income.status === 'expected').map((income) => cents(income.amount)))
  const totalPayments = sumOf(plan.payments.filter((payment) => payment.enabled).map((payment) => cents(payment.amount)))
  // "living" allocations exist only in months planned before living money became the remainder.
  const totalLiving = allocationsOf('living')
  const totalSavings = allocationsOf('savings')
  const totalOther = allocationsOf('other')
  const totalKeep = sumOf(base.map((item) => item.keep))
  const totalAvailable = sumOf(base.map((item) => item.available))
  return {
    accounts, transfers,
    isPreliminary: accounts.length === 0 || accounts.some((account) => !account.balanceConfirmed) || plan.incomes.some(amountToCheck) || plan.payments.some(amountToCheck),
    totalAvailable: safeNumber(totalAvailable), totalIncome: safeNumber(totalIncome),
    totalPayments: safeNumber(totalPayments), totalLiving: safeNumber(totalLiving),
    totalSavings: safeNumber(totalSavings), totalOther: safeNumber(totalOther), totalKeep: safeNumber(totalKeep),
    // What is left: everything after payments, savings and the amounts kept on accounts.
    freeAfterPlan: safeNumber(totalAvailable - totalPayments - totalLiving - totalSavings - totalOther - totalKeep),
    uncovered: safeNumber(targets.reduce((sum, target) => sum + target.remaining, 0n)),
  }
}
