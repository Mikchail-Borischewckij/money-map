"use client"

import { useState } from 'react'
import { AccountBadge, Button } from '@/components/ui'
import type { CategoryNames, Plan, PlanSummary } from '@/lib/domain'
import AllocationSection from './AllocationSection'
import BalancesSection from './BalancesSection'
import IncomesSection from './IncomesSection'
import PaymentsSection from './PaymentsSection'
import SummaryCard from './SummaryCard'
import TransfersSection from './TransfersSection'
import { incomeToCheck, paymentToCheck, readyForTransfers, savingsOf, type MonthActions, type UpdatePlan } from './utils'

// One month as steps plus the result. The month opens on the first step that still has work in it, so the screen
// starts with one thing instead of ninety — but that is only where it starts: every step opens and closes on its
// own, any number at once, in whatever order suits. Nothing folds or unfolds by itself after that.
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
  const [open, setOpen] = useState<Set<number>>(() => { const first = steps.find((item) => item.pending)?.step; return new Set(first ? [first] : []) })
  const at = (step: number) => ({
    open: open.has(step),
    done: doneOf(step),
    onToggle: () => setOpen((current) => { const next = new Set(current); if (!next.delete(step)) next.add(step); return next }),
  })
  const goToStep = (step: number) => {
    setOpen((current) => new Set(current).add(step))
    requestAnimationFrame(() => document.getElementById(`step-${step}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  const all = steps.map((item) => item.step)
  const allOpen = all.every((step) => open.has(step))

  return <div className="month-layout">
    <div className="month-sections">
      <div className="month-tools">
        <Button size="sm" variant="ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(all))}>{allOpen ? 'Свернуть все' : 'Развернуть все'}</Button>
      </div>
      <BalancesSection {...at(1)} plan={plan} readOnly={readOnly} update={update} onOpenSettings={actions.onOpenSettings} />
      <IncomesSection {...at(2)} plan={plan} readOnly={readOnly} update={update} accountTag={accountTag} accounts={liveAccounts} categories={categories.income} onReset={actions.onResetIncome} />
      <PaymentsSection {...at(3)} plan={plan} readOnly={readOnly} update={update} accountTag={accountTag} accounts={liveAccounts} categories={categories.payment} onReset={actions.onResetPayment} />
      <AllocationSection {...at(4)} step={4} plan={plan} readOnly={readOnly} update={update} accounts={liveAccounts} accountName={accountName} />
      <TransfersSection {...at(transfersStep)} step={transfersStep} summary={summary} accountTag={accountTag} readOnly={readOnly} ready={ready} update={update} />
    </div>
    {/* The close card stays under the result card. Below 1100px the aside is `display: contents`, so only the result
        moves above the steps and the close card keeps its place at the end. */}
    <aside className="month-summary">
      <SummaryCard summary={summary} />
      {footer?.(goToStep)}
    </aside>
  </div>
}
