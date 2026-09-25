import { ArrowRight } from 'lucide-react'
import type { PlanSummary } from '@/lib/domain'
import { amount, cx, money } from '@/lib/format'
import Section from './Section'

const signed = (value: number) => value === 0 ? '—' : `${value > 0 ? '+' : '−'} ${amount(Math.abs(value))}`

// Per account: what it has, what leaves it, the transfers in or out and what stays; then the transfers to make, in order.
export default function TransfersSection({ step, summary, accountTag }: { step: number; summary: PlanSummary; accountTag: (id: string) => React.ReactNode }) {
  const accounts = summary.accounts.filter((account) => !account.isArchived || account.available || account.needed || account.incoming || account.outgoing)
  if (accounts.length === 0) return null
  const sum = (pick: (account: typeof accounts[number]) => number) => accounts.reduce((total, account) => total + pick(account), 0)
  return <Section step={step} title="Счета и переводы" id="transfers" meta={<span>в zł</span>}>
    <div className="table-scroll">
      <table className="money-table">
        <thead><tr><th>Счёт</th><th>Есть и придёт</th><th>Уйдёт</th><th>Перевод</th><th>Останется</th></tr></thead>
        <tbody>
          {accounts.map((account) => <tr key={account.id}>
            <th scope="row">{accountTag(account.id)}{account.keep > 0 && <small>запас {amount(account.keep)}</small>}</th>
            <td>{amount(account.available)}</td>
            <td>{account.payments + account.allocations ? `− ${amount(account.payments + account.allocations)}` : '—'}</td>
            <td className={cx(account.incoming - account.outgoing > 0 && 'is-in')}>{signed(account.incoming - account.outgoing)}</td>
            <td className={cx('is-strong', account.remaining < 0 && 'negative')}>{amount(account.remaining)}</td>
          </tr>)}
        </tbody>
        <tfoot><tr>
          <th scope="row">Итого</th>
          <td>{amount(sum((account) => account.available))}</td>
          <td>− {amount(sum((account) => account.payments + account.allocations))}</td>
          <td />
          <td className="is-strong">{amount(sum((account) => account.remaining))}</td>
        </tr></tfoot>
      </table>
    </div>
    <h3 className="subhead">Что перевести</h3>
    {summary.transfers.length === 0 ? <p className="muted">Переводы не нужны.</p> : <ol className="transfer-list">
      {summary.transfers.map((transfer) => <li key={transfer.id}>
        <span className="transfer-route">{accountTag(transfer.fromAccountId)}<ArrowRight size={14} />{accountTag(transfer.toAccountId)}</span>
        <strong className="amount">{money(transfer.amount)}</strong>
      </li>)}
    </ol>}
    {summary.uncovered > 0 && <p className="warn-text">Не хватает {money(summary.uncovered)}: на счетах, с которых можно переводить, столько нет.</p>}
  </Section>
}
