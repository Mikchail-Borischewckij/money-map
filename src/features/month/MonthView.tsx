"use client"

import { useState } from 'react'
import { AccountBadge } from '@/components/ui'
import type { CategoryNames, Plan, PlanSummary } from '@/lib/domain'
import AllocationSection from './AllocationSection'
import BalancesSection from './BalancesSection'
import IncomesSection from './IncomesSection'
import PaymentsSection from './PaymentsSection'
import SummaryCard from './SummaryCard'
import TransfersSection from './TransfersSection'
import { incomeToCheck, paymentToCheck, readyForTransfers, savingsOf, type MonthActions, type UpdatePlan } from './utils'

// One month as steps plus the result. Only one step is open at a time — the first one with work left in it, unless
// the reader opened another. A folded step still shows its total and how much of it is done, so nothing is hidden,
// and the screen asks for one thing instead of ninety.
export default function MonthView({ plan, summary, readOnly, update, categories, actions, footer }: {
  plan: Plan; summary: PlanSummary; readOnly: boolean; update: UpdatePlan; categories: CategoryNames
  actions: MonthActions; footer?: (goToStep: (step: number) => void) => React.ReactNode
}) {
  const accountName = (id: string) => plan.accounts.find((account) => account.id === id)?.name ?? 'Счёт удалён'
  const accountBank = (id: string) => plan.accounts.find((account) => account.id === id)?.bank
  const liveAccounts = plan.accounts.filter((account) => !account.isArchived)
  const accountTag = (id: string) => <AccountBadge name={accountName(id)} bank={accountBank(id)} />
  const saving = Boolean(savingsOf(plan)) && liveAccounts.length > 0
  const transfersStep = saving ? 5 : 4

  // `pending` is "this step still needs a hand" and decides where the month opens; `done` is only the tick in the
  // header. A step with nothing in it is neither, so it never traps the reader.
  const balanceAccounts = plan.accounts.filter((account) => !account.isArchived || account.openingBalance !== 0)
  const plannedPayments = plan.payments.filter((payment) => payment.enabled)
  const ready = readyForTransfers(plan)
  const pendingTransfers = summary.transfers.filter((transfer) => !transfer.done).length
  const steps = [
    { step: 1, pending: balanceAccounts.some((account) => !account.balanceConfirmed), done: balanceAccounts.length > 0 && balanceAccounts.every((account) => account.balanceConfirmed) },
    { step: 2, pending: plan.incomes.some(incomeToCheck), done: plan.incomes.length > 0 && !plan.incomes.some(incomeToCheck) },
    { step: 3, pending: plan.payments.some(paymentToCheck), done: plannedPayments.length > 0 && !plan.payments.some(paymentToCheck) },
    ...(saving ? [{ step: 4, pending: false, done: false }] : []),
    { step: transfersStep, pending: !readOnly && ready && pendingTransfers > 0, done: !readOnly && ready && summary.transfers.length > 0 && pendingTransfers === 0 },
  ]
  const doneOf = (step: number) => steps.find((item) => item.step === step)?.done ?? false
  // 0 means "everything folded": the reader's own choice, and where a finished month starts.
  const [chosen, setChosen] = useState<number | null>(null)
  const current = steps.find((item) => item.pending)?.step ?? 0
  const active = chosen !== null && !doneOf(chosen) ? chosen : current
  const at = (step: number) => ({ open: active === step, onToggle: () => setChosen(active === step ? 0 : step), done: doneOf(step) })
  const goToStep = (step: number) => {
    setChosen(step)
    requestAnimationFrame(() => document.getElementById(`step-${step}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }

  return <div className="month-layout">
    <div className="month-sections">
      <BalancesSection {...at(1)} plan={plan} readOnly={readOnly} update={update} onOpenSettings={actions.onOpenSettings} />
      <IncomesSection {...at(2)} plan={plan} readOnly={readOnly} update={update} accountTag={accountTag} accounts={liveAccounts} categories={categories.income} onReset={actions.onResetIncome} />
      <PaymentsSection {...at(3)} plan={plan} readOnly={readOnly} update={update} accountTag={accountTag} accounts={liveAccounts} categories={categories.payment} onReset={actions.onResetPayment} />
      <AllocationSection {...at(4)} step={4} plan={plan} readOnly={readOnly} update={update} accounts={liveAccounts} accountName={accountName} />
      <TransfersSection {...at(transfersStep)} step={transfersStep} summary={summary} accountTag={accountTag} readOnly={readOnly} ready={ready} update={update} />
      {/* The close card belongs after the steps. It used to sit in the aside, which `order: -1` threw to the top of
          every screen under 1100px — the last action of the month arrived before the first step. */}
      {footer?.(goToStep)}
    </div>
    <aside className="month-summary"><SummaryCard summary={summary} /></aside>
  </div>
}
