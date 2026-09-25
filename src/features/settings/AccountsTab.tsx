"use client"

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { Button, Empty, RowMenu } from '@/components/ui'
import AccountDialog, { type AccountValue } from './AccountDialog'
import { send } from './api'
import { kindOptions, type AccountRow, type Preview, type Run } from './types'

const body = (account: AccountRow, patch: Partial<AccountRow>) => {
  const next = { ...account, ...patch }
  return { name: next.name, kind: next.kind, canFundTransfers: next.can_fund_transfers, priority: next.transfer_priority, version: next.version }
}

export default function AccountsTab({ accounts, csrfToken, run }: { accounts: AccountRow[]; csrfToken: string; run: Run }) {
  const [editing, setEditing] = useState<AccountRow | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const active = accounts.filter((account) => !account.is_archived).sort((a, b) => a.transfer_priority - b.transfer_priority || a.name.localeCompare(b.name))
  const archived = accounts.filter((account) => account.is_archived)

  // List order is the order money is taken for transfers; everyone is renumbered so the move is unambiguous.
  const patch = (id: string, change: Partial<AccountRow>): Preview => (lists) => ({ ...lists, accounts: lists.accounts.map((account) => account.id === id ? { ...account, ...change } : account) })
  const move = (index: number, delta: number) => {
    const order = [...active]
    const [item] = order.splice(index, 1)
    order.splice(index + delta, 0, item)
    const changes = order.map((account, position) => ({ account, priority: (position + 1) * 10 })).filter(({ account, priority }) => account.transfer_priority !== priority)
    return run(() => Promise.all(changes.map(({ account, priority }) => send(`/api/accounts/${account.id}`, 'PUT', csrfToken, body(account, { transfer_priority: priority })))), 'Порядок сохранён.',
      (lists) => ({ ...lists, accounts: lists.accounts.map((account) => ({ ...account, transfer_priority: changes.find((change) => change.account.id === account.id)?.priority ?? account.transfer_priority })) }))
  }

  const save = (value: AccountValue) => {
    const current = editing === 'new' ? null : editing
    setEditing(null)
    void run(() => current
      ? send(`/api/accounts/${current.id}`, 'PUT', csrfToken, body(current, { name: value.name, kind: value.kind, can_fund_transfers: value.canFundTransfers }))
      : send('/api/accounts', 'POST', csrfToken, { name: value.name, kind: value.kind, canFundTransfers: value.canFundTransfers, priority: (active.length + 1) * 10 }),
    current ? 'Счёт сохранён.' : 'Счёт добавлен.',
    current ? patch(current.id, { name: value.name, kind: value.kind, can_fund_transfers: value.canFundTransfers })
      : (lists) => ({ ...lists, accounts: [...lists.accounts, { id: `new-${crypto.randomUUID()}`, name: value.name, kind: value.kind, can_fund_transfers: value.canFundTransfers, transfer_priority: (active.length + 1) * 10, is_archived: false, version: 0 }] }))
  }

  return <section className="card">
    <header className="card-head"><div><h2>Счета</h2><p className="muted">Порядок — откуда в первую очередь брать деньги на переводы.</p></div>
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Счёт</Button></header>
    {active.length === 0 && <Empty>Счетов пока нет.</Empty>}
    <div className="rows">
      {active.map((account, index) => <div className="row" key={account.id}>
        <div className="row-main"><strong>{account.name}</strong><span className="row-meta">{kindOptions.find((option) => option.value === account.kind)?.label}{account.can_fund_transfers ? '' : ' · не для переводов'}</span></div>
        <div className="row-side">
          <Button variant="ghost" size="sm" aria-label={`Выше: ${account.name}`} icon={<ArrowUp size={16} />} disabled={index === 0} onClick={() => void move(index, -1)} />
          <Button variant="ghost" size="sm" aria-label={`Ниже: ${account.name}`} icon={<ArrowDown size={16} />} disabled={index === active.length - 1} onClick={() => void move(index, 1)} />
          <RowMenu label={`Действия: ${account.name}`} items={[
            { label: 'Изменить', onSelect: () => setEditing(account) },
            { label: 'В архив', danger: true, onSelect: () => void run(() => send(`/api/accounts/${account.id}`, 'DELETE', csrfToken, { expectedVersion: account.version }), 'Счёт в архиве. Закрытые месяцы не изменились.', patch(account.id, { is_archived: true })) },
          ]} />
        </div>
      </div>)}
    </div>
    {archived.length > 0 && <button type="button" className="link archived-toggle" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Скрыть архив' : `Архив · ${archived.length}`}</button>}
    {showArchived && <div className="rows">{archived.map((account) => <div className="row is-muted" key={account.id}><div className="row-main"><strong>{account.name}</strong></div></div>)}</div>}
    {editing && <AccountDialog account={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
  </section>
}
