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
      <div><dt>Отложить</dt><dd>− {money(summary.totalSavings)}</dd></div>
      {summary.totalKeep > 0 && <div><dt>Запас на бизнесе</dt><dd>− {money(summary.totalKeep)}</dd></div>}
      {summary.totalLiving > 0 && <div><dt>На жизнь (отдельно)</dt><dd>− {money(summary.totalLiving)}</dd></div>}
    </dl>
    <div className="summary-foot">
      {summary.transfers.length === 0 ? <span className="muted">Переводы не нужны</span> : <a className="link" href="#transfers">Переводы: {summary.transfers.length}</a>}
      {summary.uncovered > 0 && <p className="warn-text">Не хватает {money(summary.uncovered)} на счетах.</p>}
    </div>
  </section>
}
