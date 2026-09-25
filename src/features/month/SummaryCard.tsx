import { Badge } from '@/components/ui'
import type { PlanSummary } from '@/lib/domain'
import { cx, money } from '@/lib/format'

// The money left for living: it follows every balance, income and payment as they are typed.
export default function SummaryCard({ summary }: { summary: PlanSummary }) {
  const short = summary.freeAfterPlan < 0
  return <section className="card summary" aria-label="Итог">
    <div className={cx('summary-hero', short && 'is-short')}>
      <span>{short ? 'Не хватает' : 'На жизнь'}{summary.isPreliminary && <Badge tone="warn">предварительно</Badge>}</span>
      <strong>{money(Math.abs(summary.freeAfterPlan))}</strong>
    </div>
    <dl className="summary-lines">
      <div><dt>Есть и придёт</dt><dd>{money(summary.totalAvailable)}</dd></div>
      <div><dt>Платежи</dt><dd>− {money(summary.totalPayments)}</dd></div>
      {summary.totalSavings > 0 && <div><dt>Отложить</dt><dd>− {money(summary.totalSavings)}</dd></div>}
      {summary.totalKeep > 0 && <div><dt>Запас на бизнесе</dt><dd>− {money(summary.totalKeep)}</dd></div>}
      {summary.totalLiving > 0 && <div><dt>На жизнь (отдельно)</dt><dd>− {money(summary.totalLiving)}</dd></div>}
    </dl>
    {summary.uncovered > 0 && <p className="summary-foot warn-text">На некоторых счетах не хватает {money(summary.uncovered)} — см. «Счета и переводы».</p>}
  </section>
}
