"use client"

import { ArrowRight, Check } from 'lucide-react'
import { Badge, Checkbox, DataTable, type Column } from '@/components/ui'
import type { PlanSummary, Transfer } from '@/lib/domain'
import { cx, money } from '@/lib/format'
import Section from './Section'
import type { UpdatePlan } from './utils'

type Row = PlanSummary['accounts'][number]

const signed = (value: number) => value === 0 ? money(0) : `${value > 0 ? '+' : '−'} ${money(Math.abs(value))}`
const spent = (account: Row) => account.payments + account.allocations
const moved = (account: Row) => account.incoming - account.outgoing
const sum = (rows: Row[], pick: (account: Row) => number) => rows.reduce((total, account) => total + pick(account), 0)

// Per account: what it has, what its payments need, how much to move in (+) or out (−) and what stays; then the transfers to make, in order.
// A transfer is ticked once made, and only after balances, incomes and payments are all checked. A made transfer keeps its
// amount; if more is needed later, a new transfer for the rest appears below it ("доперевести").
export default function TransfersSection({ step, summary, accountTag, readOnly, ready, update }: {
  step: number; summary: PlanSummary; accountTag: (id: string) => React.ReactNode; readOnly: boolean; ready: boolean; update: UpdatePlan
}) {
  const accounts = summary.accounts.filter((account) => !account.isArchived || account.available || account.needed || account.incoming || account.outgoing)
  if (accounts.length === 0) return null
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Счёт', sort: (account) => account.name, mobile: 'title', cell: (account) => accountTag(account.id) },
    { key: 'available', header: 'Ожидается', align: 'right', mobileLabel: true, sort: (account) => account.available, cell: (account) => money(account.available), footer: (rows) => money(sum(rows, (account) => account.available)) },
    { key: 'spent', header: 'К оплате', align: 'right', mobileLabel: true, sort: spent,
      cell: (account) => <span className={cx(spent(account) > 0 && 'is-out')}>{spent(account) ? `− ${money(spent(account))}` : money(0)}</span>,
      footer: (rows) => <span className="is-out">− {money(sum(rows, spent))}</span> },
    { key: 'moved', header: 'Перевод', align: 'right', mobileLabel: true, sort: moved,
      cell: (account) => <span className={cx(moved(account) > 0 ? 'is-in' : moved(account) < 0 && 'is-out')}>{signed(moved(account))}</span> },
    { key: 'remaining', header: 'Остаток', align: 'right', mobile: 'amount', sort: (account) => account.remaining,
      cell: (account) => <strong className={cx(account.remaining < 0 && 'negative')}>{money(account.remaining)}</strong>,
      footer: (rows) => money(sum(rows, (account) => account.remaining)) },
  ]
  const pending = summary.transfers.filter((transfer) => !transfer.done).length
  const topUp = (transfer: Transfer) => !transfer.done && summary.transfers.some((other) => other.done && other.fromAccountId === transfer.fromAccountId && other.toAccountId === transfer.toAccountId)
  const mark = (transfer: Transfer, made: boolean) => update((current) => ({
    ...current,
    doneTransfers: made
      ? [...(current.doneTransfers ?? []), { id: crypto.randomUUID(), fromAccountId: transfer.fromAccountId, toAccountId: transfer.toAccountId, amount: transfer.amount }]
      : (current.doneTransfers ?? []).filter((item) => item.id !== transfer.id),
  }))
  return <Section step={step} title="Счета и переводы" id="transfers" done={!readOnly && ready && summary.transfers.length > 0 && pending === 0} meta={!readOnly && pending > 0 && ready && `не переведено ${pending}`}>
    <DataTable label="Счета и переводы" rows={accounts} rowKey={(account) => account.id} columns={columns} search={(account) => account.name} />
    <h3 className="subhead">Что перевести</h3>
    {!readOnly && !ready && summary.transfers.length > 0 && <p className="note">Отметить переводы можно после проверки остатков, доходов и платежей.</p>}
    {summary.transfers.length === 0 ? <p className="muted">Переводы не нужны.</p> : <ol className="transfer-list">
      {summary.transfers.map((transfer) => <li key={transfer.id} className={cx(transfer.done && 'is-done')}>
        <span className="transfer-route">{accountTag(transfer.fromAccountId)}<ArrowRight size={14} />{accountTag(transfer.toAccountId)}{topUp(transfer) && <Badge tone="warn">доперевести</Badge>}</span>
        <strong className="amount">{money(transfer.amount)}</strong>
        {readOnly
          ? <span className="transfer-check">{transfer.done && <Check size={16} className="checked-mark" aria-label="Переведено" />}</span>
          : <Checkbox checked={transfer.done} disabled={!transfer.done && !ready} label={`Переведено: ${money(transfer.amount)}`} onChange={(made) => mark(transfer, made)} />}
      </li>)}
    </ol>}
    {summary.uncovered > 0 && <p className="warn-text">Не хватает {money(summary.uncovered)}: на счетах, с которых можно переводить, столько нет.</p>}
  </Section>
}
