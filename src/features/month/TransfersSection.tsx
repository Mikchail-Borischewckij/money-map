"use client"

import { ArrowRight, Check } from 'lucide-react'
import { Badge, Checkbox, DataTable, type Column } from '@/components/ui'
import type { PlanSummary, Transfer } from '@/lib/domain'
import { amount, cx, money } from '@/lib/format'
import { progress } from './Progress'
import Section from './Section'
import type { UpdatePlan } from './utils'

type Row = PlanSummary['accounts'][number]

const signed = (value: number) => value === 0 ? amount(0) : `${value > 0 ? '+' : '−'} ${amount(Math.abs(value))}`
const spent = (account: Row) => account.payments + account.allocations
const moved = (account: Row) => account.incoming - account.outgoing
const sum = (rows: Row[], pick: (account: Row) => number) => rows.reduce((total, account) => total + pick(account), 0)

// Per account: what it has, what its payments need, how much to move in (+) or out (−) and what stays; then the transfers to make, in order.
// A transfer is ticked once made, and only after balances, incomes and payments are all checked. A made transfer keeps its
// amount; if more is needed later, a new transfer for the rest appears below it ("доперевести").
export default function TransfersSection({ step, summary, accountTag, readOnly, ready, update, open, onToggle, done }: {
  step: number; summary: PlanSummary; accountTag: (id: string) => React.ReactNode; readOnly: boolean; ready: boolean
  update: UpdatePlan; open: boolean; onToggle: () => void; done: boolean
}) {
  const accounts = summary.accounts.filter((account) => !account.isArchived || account.available || account.needed || account.incoming || account.outgoing)
  if (accounts.length === 0) return null
  // No colour on ordinary money moving about: the sign already says which way it goes. Red is kept for the one
  // thing that is actually wrong — an account that ends the month short.
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Счёт', sort: (account) => account.name, mobile: 'title', cell: (account) => accountTag(account.id) },
    { key: 'available', header: 'Будет на счёте', align: 'right', mobileLabel: true, sort: (account) => account.available, cell: (account) => amount(account.available), footer: (rows) => money(sum(rows, (account) => account.available)) },
    { key: 'spent', header: 'К оплате', align: 'right', mobileLabel: true, sort: spent,
      cell: (account) => spent(account) ? `− ${amount(spent(account))}` : amount(0),
      footer: (rows) => `− ${money(sum(rows, spent))}` },
    { key: 'moved', header: 'Перевод', align: 'right', mobileLabel: true, sort: moved, cell: (account) => signed(moved(account)) },
    { key: 'remaining', header: 'Останется', align: 'right', mobile: 'amount', sort: (account) => account.remaining,
      cell: (account) => <strong className={cx(account.remaining < 0 && 'negative')}>{amount(account.remaining)}</strong>,
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
  return <Section step={step} title="Счета и переводы" open={open} onToggle={onToggle} done={done}
    total={pending > 0 && `Перевести ${money(summary.transfers.filter((transfer) => !transfer.done).reduce((sum, transfer) => sum + transfer.amount, 0))}`}
    meta={!readOnly && ready && progress(summary.transfers.length - pending, summary.transfers.length, 'Переведено')}>
    <DataTable label="Счета и переводы" rows={accounts} rowKey={(account) => account.id} columns={columns} search={(account) => account.name} />
    <h3 className="subhead">Что перевести</h3>
    {!readOnly && !ready && summary.transfers.length > 0 && <p className="note">Отметить переводы можно после проверки остатков, доходов и платежей.</p>}
    {summary.transfers.length === 0 ? <p className="muted">Переводы не нужны.</p> : <ol className="transfer-list">
      {summary.transfers.map((transfer) => <li key={transfer.id} className={cx(transfer.done && 'is-done')}>
        <span className="transfer-route">{accountTag(transfer.fromAccountId)}<ArrowRight size={14} />{accountTag(transfer.toAccountId)}{topUp(transfer) && <Badge tone="warn">Доперевести</Badge>}</span>
        <strong className="amount">{money(transfer.amount)}</strong>
        {readOnly
          ? <span className="transfer-check">{transfer.done && <Check size={16} className="checked-mark" aria-label="Переведено" />}</span>
          : <Checkbox checked={transfer.done} disabled={!transfer.done && !ready} label={`Переведено: ${money(transfer.amount)}`} onChange={(made) => mark(transfer, made)} />}
      </li>)}
    </ol>}
    {summary.uncovered > 0 && <p className="warn-text">Не хватает {money(summary.uncovered)}: на счетах, с которых можно переводить, столько нет.</p>}
  </Section>
}
