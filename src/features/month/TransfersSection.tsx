"use client"

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { TableToolbar } from '@/components/ui'
import type { PlanSummary } from '@/lib/domain'
import { amount, cx, money } from '@/lib/format'
import Section from './Section'

const signed = (value: number) => value === 0 ? '0' : `${value > 0 ? '+' : '−'} ${amount(Math.abs(value))}`

// Per account: what it has, what its payments need, how much to move in (+) or out (−) and what stays; then the transfers to make, in order.
export default function TransfersSection({ step, summary, accountTag }: { step: number; summary: PlanSummary; accountTag: (id: string) => React.ReactNode }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'name' | 'balance' | 'transfer'>('name')
  const allAccounts = summary.accounts.filter((account) => !account.isArchived || account.available || account.needed || account.incoming || account.outgoing)
  const accounts = allAccounts.filter((account) => account.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))
  accounts.sort((a, b) => sort === 'balance' ? b.remaining - a.remaining : sort === 'transfer' ? (b.incoming - b.outgoing) - (a.incoming - a.outgoing) : a.name.localeCompare(b.name, 'ru'))
  if (allAccounts.length === 0) return null
  const sum = (pick: (account: typeof accounts[number]) => number) => accounts.reduce((total, account) => total + pick(account), 0)
  return <Section step={step} title="Счета и переводы" id="transfers" meta={<span>в zł</span>}>
    <TableToolbar query={query} onQueryChange={setQuery} sort={sort} onSortChange={setSort} sortOptions={[
      { value: 'name', label: 'По счёту' }, { value: 'balance', label: 'По остатку' }, { value: 'transfer', label: 'По переводу' },
    ]} />
    <div className="table-scroll">
      <table className="money-table">
        <thead><tr>
          <th>Счёт</th>
          <th>Ожидается</th>
          <th>К оплате</th>
          <th>Перевод</th>
          <th>Остаток</th>
        </tr></thead>
        <tbody>
          {accounts.length === 0 && <tr><td colSpan={5} className="muted">Ничего не найдено.</td></tr>}
          {accounts.map((account) => <tr key={account.id}>
            <th scope="row">{accountTag(account.id)}</th>
            <td>{amount(account.available)}</td>
            <td className="is-out">{account.payments + account.allocations ? `− ${amount(account.payments + account.allocations)}` : '0'}</td>
            <td className={cx(account.incoming - account.outgoing > 0 ? 'is-in' : account.incoming - account.outgoing < 0 && 'is-out')}>{signed(account.incoming - account.outgoing)}</td>
            <td className={cx('is-strong', account.remaining < 0 && 'negative')}>{amount(account.remaining)}</td>
          </tr>)}
        </tbody>
        <tfoot><tr>
          <th scope="row">Итого</th>
          <td>{amount(sum((account) => account.available))}</td>
          <td className="is-out">− {amount(sum((account) => account.payments + account.allocations))}</td>
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
