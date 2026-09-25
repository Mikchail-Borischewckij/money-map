import { AccountBadge } from '@/components/ui'
import { accountHue } from '@/lib/account-color'
import type { Plan, PlanSummary } from '@/lib/domain'
import AllocationSection from './AllocationSection'
import BalancesSection from './BalancesSection'
import IncomesSection from './IncomesSection'
import PaymentsSection from './PaymentsSection'
import SummaryCard from './SummaryCard'
import TransfersSection from './TransfersSection'
import { savingsOf, type MonthActions, type UpdatePlan } from './utils'

// One month as steps plus the summary; "Отложить" is a step only when something is set aside. A closed month renders the same layout without inputs.
export default function MonthView({ plan, summary, readOnly, update, categories, actions, footer }: {
  plan: Plan; summary: PlanSummary; readOnly: boolean; update: UpdatePlan; categories: string[]
  actions: MonthActions; footer: React.ReactNode
}) {
  const accountName = (id: string) => plan.accounts.find((account) => account.id === id)?.name ?? 'Счёт удалён'
  const liveAccounts = plan.accounts.filter((account) => !account.isArchived)
  const accountTag = (id: string) => <AccountBadge name={accountName(id)} hue={accountHue(plan.accounts, id)} />
  const saving = Boolean(savingsOf(plan)) && liveAccounts.length > 0
  return <div className="month-layout">
    <div className="month-sections">
      <BalancesSection plan={plan} readOnly={readOnly} update={update} onOpenSettings={actions.onOpenSettings} />
      <IncomesSection plan={plan} readOnly={readOnly} update={update} accountTag={accountTag} accounts={liveAccounts} onReset={actions.onResetIncome} />
      <PaymentsSection plan={plan} readOnly={readOnly} update={update} accountTag={accountTag} accounts={liveAccounts} categories={categories} onReset={actions.onResetPayment} />
      <AllocationSection plan={plan} step={4} readOnly={readOnly} update={update} accounts={liveAccounts} accountName={accountName} />
      <TransfersSection step={saving ? 5 : 4} summary={summary} accountTag={accountTag} />
    </div>
    <aside className="month-summary">
      <SummaryCard summary={summary} />
      {footer}
    </aside>
  </div>
}
