import type { Plan, PlanSummary } from '@/lib/domain'
import AllocationSection from './AllocationSection'
import BalancesSection from './BalancesSection'
import IncomesSection from './IncomesSection'
import PaymentsSection from './PaymentsSection'
import SummaryCard from './SummaryCard'
import type { MonthActions, UpdatePlan } from './utils'

// One month as five steps plus the summary. A closed month renders the same layout without inputs.
export default function MonthView({ plan, summary, readOnly, update, categories, actions, footer }: {
  plan: Plan; summary: PlanSummary; readOnly: boolean; update: UpdatePlan; categories: string[]
  actions: MonthActions; footer: React.ReactNode
}) {
  const accountName = (id: string) => plan.accounts.find((account) => account.id === id)?.name ?? 'Счёт удалён'
  const liveAccounts = plan.accounts.filter((account) => !account.isArchived)
  return <div className="month-layout">
    <div className="month-sections">
      <BalancesSection plan={plan} readOnly={readOnly} update={update} onOpenSettings={actions.onOpenSettings} />
      <IncomesSection plan={plan} readOnly={readOnly} update={update} accountName={accountName} accounts={liveAccounts} onReset={actions.onResetIncome} />
      <PaymentsSection plan={plan} readOnly={readOnly} update={update} accountName={accountName} accounts={liveAccounts} categories={categories} onReset={actions.onResetPayment} />
      <AllocationSection plan={plan} readOnly={readOnly} update={update} accounts={liveAccounts} accountName={accountName} />
    </div>
    <aside className="month-summary">
      <SummaryCard summary={summary} accountName={accountName} />
      {footer}
    </aside>
  </div>
}
