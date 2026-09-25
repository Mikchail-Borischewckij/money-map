"use client"

import { useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Plus } from 'lucide-react'
import { AccountBadge, Button, Empty, RowMenu } from '@/components/ui'
import { accountHue } from '@/lib/account-color'
import { toCents } from '@/lib/api-client'
import { money } from '@/lib/format'
import AccountDialog, { type AccountValue } from './AccountDialog'
import { send } from './api'
import { kindOptions, type AccountRow, type Preview, type Run } from './types'

const body = (account: AccountRow, patch: Partial<AccountRow>) => {
  const next = { ...account, ...patch }
  return { name: next.name, kind: next.kind, canFundTransfers: next.can_fund_transfers, priority: next.transfer_priority, version: next.version, sweepToAccountId: next.sweep_to_account_id ?? null, keepAmount: Number(next.keep_amount ?? 0) }
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

  const fields = (value: AccountValue): Partial<AccountRow> => ({ name: value.name, kind: value.kind, can_fund_transfers: value.canFundTransfers, sweep_to_account_id: value.sweepToAccountId, keep_amount: toCents(value.keepAmount) })
  const kindLabel = (account: AccountRow) => kindOptions.find((option) => option.value === account.kind)?.label
  const badge = (id: string) => <AccountBadge name={accounts.find((item) => item.id === id)?.name ?? 'Счёт удалён'} hue={accountHue(accounts, id)} />
  // How the account takes part in transfers.
  const transfers = (account: AccountRow) => {
    if (account.kind === 'business') {
      const keep = Number(account.keep_amount ?? 0)
      return <span className="cell-flow">{account.sweep_to_account_id ? <>Остаток <ArrowRight size={14} /> {badge(account.sweep_to_account_id)}</> : 'Остаток не переводится'}{keep > 0 && <span className="muted">запас {money(keep / 100)}</span>}</span>
    }
    return account.can_fund_transfers ? 'Можно брать' : <span className="muted">Не брать</span>
  }
  // An archived account comes back last in the transfer order and appears in the open month again.
  const restore = (account: AccountRow) => run(() => send(`/api/accounts/${account.id}/restore`, 'POST', csrfToken, { expectedVersion: account.version }), 'Счёт снова в работе. Он появился в открытом месяце.',
    patch(account.id, { is_archived: false, transfer_priority: (active.length + 1) * 10 }))
  const save = (value: AccountValue) => {
    const current = editing === 'new' ? null : editing
    setEditing(null)
    void run(() => current
      ? send(`/api/accounts/${current.id}`, 'PUT', csrfToken, body(current, fields(value)))
      : send('/api/accounts', 'POST', csrfToken, { name: value.name, kind: value.kind, canFundTransfers: value.canFundTransfers, priority: (active.length + 1) * 10, sweepToAccountId: value.sweepToAccountId, keepAmount: toCents(value.keepAmount) }),
    current ? 'Счёт сохранён.' : 'Счёт добавлен.',
    current ? patch(current.id, fields(value))
      : (lists) => ({ ...lists, accounts: [...lists.accounts, { id: `new-${crypto.randomUUID()}`, transfer_priority: (active.length + 1) * 10, is_archived: false, version: 0, ...fields(value) } as AccountRow] }))
  }

  return <section className="card">
    <header className="card-head"><div><h2>Счета</h2><p className="muted">№ — откуда в первую очередь брать деньги на переводы.</p></div>
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Счёт</Button></header>
    {active.length === 0 && <Empty>Счетов пока нет.</Empty>}
    {active.length > 0 && <div className="table-scroll"><table className="data-table">
      <thead><tr><th className="num col-narrow">№</th><th>Счёт</th><th className="col-opt">Тип</th><th className="col-opt">Переводы</th><th className="actions"><span className="sr-only">Действия</span></th></tr></thead>
      <tbody>{active.map((account, index) => <tr key={account.id}>
        <td className="num col-narrow muted">{index + 1}</td>
        <td>{badge(account.id)}<div className="cell-sub"><span>{kindLabel(account)}</span>{transfers(account)}</div></td>
        <td className="col-opt">{kindLabel(account)}</td>
        <td className="col-opt">{transfers(account)}</td>
        <td className="actions"><div className="cell-actions">
          <Button variant="ghost" size="sm" aria-label={`Выше: ${account.name}`} icon={<ArrowUp size={16} />} disabled={index === 0} onClick={() => void move(index, -1)} />
          <Button variant="ghost" size="sm" aria-label={`Ниже: ${account.name}`} icon={<ArrowDown size={16} />} disabled={index === active.length - 1} onClick={() => void move(index, 1)} />
          <RowMenu label={`Действия: ${account.name}`} items={[
            { label: 'Изменить', onSelect: () => setEditing(account) },
            { label: 'В архив', danger: true, onSelect: () => void run(() => send(`/api/accounts/${account.id}`, 'DELETE', csrfToken, { expectedVersion: account.version }), 'Счёт в архиве. Закрытые месяцы не изменились.', patch(account.id, { is_archived: true })) },
          ]} />
        </div></td>
      </tr>)}</tbody>
    </table></div>}
    {archived.length > 0 && <button type="button" className="link archived-toggle" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Скрыть архив' : `Архив · ${archived.length}`}</button>}
    {showArchived && <table className="data-table"><tbody>{archived.map((account) => <tr className="is-muted" key={account.id}>
      <td className="cell-name">{account.name}</td><td className="col-opt">{kindLabel(account)}</td>
      <td className="actions"><Button size="sm" onClick={() => void restore(account)}>Вернуть</Button></td>
    </tr>)}</tbody></table>}
    {editing && <AccountDialog account={editing === 'new' ? null : editing} accounts={accounts} onClose={() => setEditing(null)} onSave={save} />}
  </section>
}
