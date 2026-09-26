import { Badge } from '@/components/ui'
import type { PlanSummary } from '@/lib/domain'
import { cx, money } from '@/lib/format'

// The money left for living: it follows every balance, income and payment as they are typed.
// "Остаток" means three other things in this app (the balances, what stays on an account, a business
// account's excess), so the result says what it is instead.
export default function SummaryCard({ summary }: { summary: PlanSummary }) {
  const short = summary.freeAfterPlan < 0
  return <section className="card summary" aria-label="Итог">
    <div className={cx('summary-hero', short && 'is-short')}>
      <span>{short ? 'Не хватает' : 'Остаётся на жизнь'}{summary.isPreliminary && <Badge tone="warn">Предварительно</Badge>}</span>
      <strong>{money(Math.abs(summary.freeAfterPlan))}</strong>
    </div>
    <dl className="summary-lines">
      <div><dt>Всего денег</dt><dd>{money(summary.totalAvailable)}</dd></div>
      <div><dt>Платежи</dt><dd>− {money(summary.totalPayments)}</dd></div>
      {summary.totalSavings > 0 && <div><dt>Отложить</dt><dd>− {money(summary.totalSavings)}</dd></div>}
      {/* Only a business account holds a reserve, and only closed months from before rule 8 plan living money apart. */}
      {summary.totalKeep > 0 && <div><dt>Запас на бизнес-счетах</dt><dd>− {money(summary.totalKeep)}</dd></div>}
      {summary.totalLiving > 0 && <div><dt>Запланировано на жизнь</dt><dd>− {money(summary.totalLiving)}</dd></div>}
    </dl>
    {summary.uncovered > 0 && <p className="summary-foot warn-text">Не покрыто {money(summary.uncovered)}. Проверьте счета и переводы.</p>}
  </section>
}
