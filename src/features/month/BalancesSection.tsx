import { Check } from 'lucide-react'
import { AccountBadge, Button, Checkbox, Empty } from '@/components/ui'
import type { Account, Plan } from '@/lib/domain'
import { money } from '@/lib/format'
import Amount from './Amount'
import { progress } from './Progress'
import Section from './Section'
import { total, type UpdatePlan } from './utils'

const today = () => new Date().toISOString().slice(0, 10)

export default function BalancesSection({ plan, readOnly, update, onOpenSettings, open, onToggle, done }: {
  plan: Plan; readOnly: boolean; update: UpdatePlan; onOpenSettings: () => void; open: boolean; onToggle: () => void; done: boolean
}) {
  const accounts = plan.accounts.filter((account) => !account.isArchived || account.openingBalance !== 0)
  const checked = accounts.filter((account) => account.balanceConfirmed).length
  const change = (id: string, patch: Partial<Account>) => update((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === id ? { ...account, ...patch } : account) }))
  const sum = total(accounts.map((account) => ({ amount: account.openingBalance })))
  // Most months nothing has moved and every balance is right: one button instead of one click per account.
  const confirmAll = () => update((current) => ({ ...current, accounts: current.accounts.map((account) => account.balanceConfirmed ? account : { ...account, balanceConfirmed: true, balanceDate: today() }) }))
  const left = accounts.length - checked
  return <Section step={1} title="Сколько сейчас на счетах" open={open} onToggle={onToggle} done={done}
    total={accounts.length > 0 && money(sum)} meta={progress(checked, accounts.length)}
    action={!readOnly && left > 1 && <Button size="sm" variant="ghost" onClick={confirmAll}>Проверить все</Button>}>
    {accounts.length === 0 && <Empty>Счетов пока нет. <Button variant="ghost" size="sm" onClick={onOpenSettings}>Добавить в настройках</Button></Empty>}
    <div className="rows">
      {accounts.map((account) => <div className="row" key={account.id}>
        <div className="row-main"><strong><AccountBadge name={account.name} bank={account.bank} /></strong></div>
        <div className="row-side">
          {/* Editing a checked amount unchecks it, so the count in the header is always honest. */}
          <Amount label={`Сколько на счёте: ${account.name}`} value={account.openingBalance} readOnly={readOnly} className="amount-locked"
            onChange={(openingBalance) => change(account.id, { openingBalance, balanceConfirmed: false, balanceDate: null })} />
          {readOnly
            ? account.balanceConfirmed && <Check size={16} className="checked-mark" aria-label="Проверено" />
            : <Checkbox checked={account.balanceConfirmed ?? false} onChange={(balanceConfirmed) => change(account.id, { balanceConfirmed, balanceDate: balanceConfirmed ? today() : null })}>Проверено</Checkbox>}
        </div>
      </div>)}
    </div>
    {accounts.length > 0 && <div className="total-row"><span>Итого</span><strong className="amount">{money(sum)}</strong></div>}
  </Section>
}
