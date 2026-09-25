import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { PlanSummary } from '@/lib/domain'
import { cx, money } from '@/lib/format'

export default function SummaryCard({ summary, accountName }: { summary: PlanSummary; accountName: (id: string) => string }) {
  const short = summary.freeAfterPlan < 0
  return <section className="card summary" aria-label="Итог">
    <div className={cx('summary-hero', short && 'is-short')}>
      <span>{short ? 'Не хватает' : 'Свободно'}{summary.isPreliminary && <Badge tone="warn">предварительно</Badge>}</span>
      <strong>{money(Math.abs(summary.freeAfterPlan))}</strong>
    </div>
    <dl className="summary-lines">
      <div><dt>Есть и придёт</dt><dd>{money(summary.totalAvailable)}</dd></div>
      <div><dt>Платежи</dt><dd>− {money(summary.totalPayments)}</dd></div>
      <div><dt>На жизнь</dt><dd>− {money(summary.totalLiving)}</dd></div>
      <div><dt>Отложить</dt><dd>− {money(summary.totalSavings)}</dd></div>
    </dl>
    <div className="transfers">
      <h3>Переводы</h3>
      {summary.transfers.length === 0 && <p className="muted">Не нужны</p>}
      {summary.transfers.map((transfer) => <div className="transfer" key={transfer.id}>
        <span className="transfer-route"><span>{accountName(transfer.fromAccountId)}</span><ArrowRight size={14} /><span>{accountName(transfer.toAccountId)}</span></span><strong>{money(transfer.amount)}</strong>
      </div>)}
      {summary.uncovered > 0 && <p className="warn-text">Не хватает {money(summary.uncovered)}: на счетах, с которых можно переводить, столько нет.</p>}
    </div>
    {summary.accounts.length > 0 && <details className="by-account">
      <summary>По счетам</summary>
      {summary.accounts.map((account) => <div className="by-account-row" key={account.id}>
        <span>{account.name}</span><span className="muted">нужно {money(account.needed)}</span><strong>{money(account.available)}</strong>
      </div>)}
    </details>}
  </section>
}
