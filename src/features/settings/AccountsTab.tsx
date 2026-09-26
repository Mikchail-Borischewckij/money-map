"use client"

import { useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import { AccountBadge, AddButton, Button, DataTable, Empty, RowMenu, type Column } from '@/components/ui'
import { toCents } from '@/lib/api-client'
import { hasTransferPriority } from '@/lib/domain'
import { money } from '@/lib/format'
import AccountDialog, { type AccountValue } from './AccountDialog'
import ArchiveTabs, { type ArchiveTab } from './ArchiveTabs'
import { send } from './api'
import { kindOptions, type AccountRow, type Preview, type Run } from './types'

const body = (account: AccountRow, patch: Partial<AccountRow>) => {
  const next = { ...account, ...patch }
  return { name: next.name, bank: next.bank, kind: next.kind, canFundTransfers: next.can_fund_transfers, priority: next.transfer_priority, version: next.version, sweepToAccountId: next.sweep_to_account_id ?? null, keepAmount: Number(next.keep_amount ?? 0) }
}
const kindLabel = (account: AccountRow) => kindOptions.find((option) => option.value === account.kind)?.label ?? ''
const ranked = (account: AccountRow) => hasTransferPriority(account)

export default function AccountsTab({ accounts, csrfToken, run }: { accounts: AccountRow[]; csrfToken: string; run: Run }) {
  const [editing, setEditing] = useState<AccountRow | 'new' | null>(null)
  const [tab, setTab] = useState<ArchiveTab>('active')
  // The order of the ranked accounts is the order money is taken for transfers; business and cash accounts follow, unnumbered.
  const live = accounts.filter((account) => !account.is_archived)
  const active = [
    ...live.filter(ranked).sort((a, b) => a.transfer_priority - b.transfer_priority || a.name.localeCompare(b.name, 'ru')),
    ...live.filter((account) => !ranked(account)).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
  ]
  const order = active.filter(ranked)
  const archived = accounts.filter((account) => account.is_archived)

  const patch = (id: string, change: Partial<AccountRow>): Preview => (lists) => ({ ...lists, accounts: lists.accounts.map((account) => account.id === id ? { ...account, ...change } : account) })
  // Everyone is renumbered so the new order is unambiguous.
  const reorder = (keys: string[]) => {
    const changes = keys.map((id, position) => ({ account: order.find((account) => account.id === id)!, priority: (position + 1) * 10 })).filter(({ account, priority }) => account.transfer_priority !== priority)
    if (changes.length === 0) return
    void run(() => Promise.all(changes.map(({ account, priority }) => send(`/api/accounts/${account.id}`, 'PUT', csrfToken, body(account, { transfer_priority: priority })))), 'Сохранено.',
      (lists) => ({ ...lists, accounts: lists.accounts.map((account) => ({ ...account, transfer_priority: changes.find((change) => change.account.id === account.id)?.priority ?? account.transfer_priority })) }))
  }

  // One step up or down with the arrow buttons; dragging does the same in one go.
  const step = (account: AccountRow, delta: number) => {
    const keys = order.map((item) => item.id)
    const index = keys.indexOf(account.id)
    keys.splice(index, 1)
    keys.splice(index + delta, 0, account.id)
    reorder(keys)
  }

  const fields = (value: AccountValue): Partial<AccountRow> => ({ name: value.name, bank: value.bank, kind: value.kind, can_fund_transfers: value.canFundTransfers, sweep_to_account_id: value.sweepToAccountId, keep_amount: toCents(value.keepAmount) })
  const badge = (id: string) => {
    const account = accounts.find((item) => item.id === id)
    return <AccountBadge name={account?.name ?? 'Счёт удалён'} bank={account?.bank} />
  }
  // How the account takes part in transfers. Only a business account holds a reserve back from its sweep.
  const transfers = (account: AccountRow) => {
    const keep = Number(account.keep_amount ?? 0)
    if (account.kind === 'business') return <span className="cell-flow">{account.sweep_to_account_id ? <>Излишек <ArrowRight size={14} /> {badge(account.sweep_to_account_id)}</> : 'Излишек не переводится'}{keep > 0 && <span className="muted">оставлять {money(keep / 100)}</span>}</span>
    return <span className="cell-flow">{account.kind === 'cash' ? <span className="muted">Только пополнение</span> : account.can_fund_transfers ? 'Можно брать' : <span className="muted">Не брать</span>}</span>
  }
  // An archived account comes back last in the transfer order and appears in the open month again.
  const restore = (account: AccountRow) => run(() => send(`/api/accounts/${account.id}/restore`, 'POST', csrfToken, { expectedVersion: account.version }), 'Вернули из архива. Счёт появился в открытом месяце.',
    patch(account.id, { is_archived: false, transfer_priority: (order.length + 1) * 10 }))
  const save = (value: AccountValue) => {
    const current = editing === 'new' ? null : editing
    setEditing(null)
    void run(() => current
      ? send(`/api/accounts/${current.id}`, 'PUT', csrfToken, body(current, fields(value)))
      : send('/api/accounts', 'POST', csrfToken, { name: value.name, bank: value.bank, kind: value.kind, canFundTransfers: value.canFundTransfers, priority: (order.length + 1) * 10, sweepToAccountId: value.sweepToAccountId, keepAmount: toCents(value.keepAmount) }),
    current ? 'Сохранено.' : 'Добавлено.',
    current ? patch(current.id, fields(value))
      : (lists) => ({ ...lists, accounts: [...lists.accounts, { id: `new-${crypto.randomUUID()}`, transfer_priority: (order.length + 1) * 10, is_archived: false, version: 0, ...fields(value) } as AccountRow] }))
  }

  const activeColumns: Column<AccountRow>[] = [
    { key: 'number', header: '№', className: 'col-narrow muted', mobile: 'hidden', cell: (account) => ranked(account) ? order.indexOf(account) + 1 : '' },
    { key: 'name', header: 'Счёт', mobile: 'title', cell: (account) => badge(account.id) },
    { key: 'kind', header: 'Тип', cell: kindLabel },
    { key: 'transfers', header: 'Переводы', cell: transfers },
    { key: 'actions', header: 'Действия', hideHeader: true, mobile: 'end', className: 'actions', cell: (account) => <div className="cell-actions">
      {ranked(account) && <>
        <Button variant="ghost" size="sm" aria-label={`Выше: ${account.name}`} icon={<ArrowUp size={16} />} disabled={order.indexOf(account) === 0} onClick={() => step(account, -1)} />
        <Button variant="ghost" size="sm" aria-label={`Ниже: ${account.name}`} icon={<ArrowDown size={16} />} disabled={order.indexOf(account) === order.length - 1} onClick={() => step(account, 1)} />
      </>}
      <RowMenu label={`Действия: ${account.name}`} items={[
        { label: 'Изменить', onSelect: () => setEditing(account) },
        { label: 'В архив', danger: true, onSelect: () => void run(() => send(`/api/accounts/${account.id}`, 'DELETE', csrfToken, { expectedVersion: account.version }), 'В архиве. Закрытые месяцы не изменились.', patch(account.id, { is_archived: true })) },
      ]} />
    </div> },
  ]
  const archivedColumns: Column<AccountRow>[] = [
    { key: 'name', header: 'Счёт', mobile: 'title', sort: (account) => account.name, cell: (account) => badge(account.id) },
    { key: 'kind', header: 'Тип', sort: kindLabel, filter: { type: 'list', value: kindLabel }, cell: kindLabel },
    { key: 'actions', header: 'Действия', hideHeader: true, mobile: 'end', className: 'actions', cell: (account) => <Button size="sm" onClick={() => void restore(account)}>Вернуть из архива</Button> },
  ]

  return <section className="card">
    <header className="card-head"><div><h2>Счета</h2><p className="muted">Порядок счетов — порядок, в котором берутся деньги для переводов. Перетащите строку, чтобы его изменить.</p></div>
      <ArchiveTabs value={tab} onChange={setTab} archived={archived.length} /></header>
    {tab === 'active'
      ? <DataTable key="active" label="Счета" rows={active} rowKey={(account) => account.id} columns={activeColumns}
        reorder={{ canMove: ranked, onMove: reorder, label: (account) => account.name }}
        actions={<AddButton onClick={() => setEditing('new')} />} empty={<Empty>Счетов пока нет.</Empty>} />
      : <DataTable key="archived" label="Счета в архиве" rows={archived} rowKey={(account) => account.id} columns={archivedColumns} rowClassName={() => 'is-muted'}
        defaultSort={{ key: 'name', dir: 'asc' }} search={(account) => account.name} empty={<Empty>В архиве пока пусто.</Empty>} />}
    {editing && <AccountDialog account={editing === 'new' ? null : editing} accounts={accounts} onClose={() => setEditing(null)} onSave={save} />}
  </section>
}
