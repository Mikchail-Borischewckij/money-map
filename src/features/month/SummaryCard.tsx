import { Badge } from '@/components/ui'
import type { PlanSummary } from '@/lib/domain'
import { cx, money } from '@/lib/format'

// The money left after the plan follows every balance, income and payment as they are typed.
export default function SummaryCard({ summary }: { summary: PlanSummary }) {
  const short = summary.freeAfterPlan < 0
  return <section className="card summary" aria-label="Итог">
    <div className={cx('summary-hero', short && 'is-short')}>
      <span>{short ? 'Не хватает' : 'Остаётся'}{summary.isPreliminary && <Badge>Предварительно</Badge>}</span>
      <strong>{money(Math.abs(summary.freeAfterPlan))}</strong>
    </div>
    <dl className="summary-lines">
      <div><dt>Всего денег</dt><dd>{money(summary.totalAvailable)}</dd></div>
      <div><dt>Платежи</dt><dd>{money(summary.totalPayments)}</dd></div>
      {summary.totalSavings > 0 && <div><dt>Отложить</dt><dd>−{money(summary.totalSavings)}</dd></div>}
      {/* Amounts kept on accounts have no line: they stay where they are and are already inside the result.
          "Запланировано на жизнь" only ever appears in months closed before rule 8. */}
      {summary.totalLiving > 0 && <div><dt>Запланировано на жизнь</dt><dd>−{money(summary.totalLiving)}</dd></div>}
    </dl>
    {summary.uncovered > 0 && <p className="summary-foot warn-text">Не покрыто {money(summary.uncovered)}. Проверьте счета и переводы.</p>}
  </section>
}
