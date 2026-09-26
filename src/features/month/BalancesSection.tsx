import { AccountBadge, Badge, Button, Checkbox, Empty } from '@/components/ui'
import type { Account, Plan } from '@/lib/domain'
import { money } from '@/lib/format'
import Amount from './Amount'
import { progress } from './Progress'
import Section from './Section'
import { total, type UpdatePlan } from './utils'

const today = () => new Date().toISOString().slice(0, 10)

export default function BalancesSection({ plan, readOnly, update, onOpenSettings }: { plan: Plan; readOnly: boolean; update: UpdatePlan; onOpenSettings: () => void }) {
  const accounts = plan.accounts.filter((account) => !account.isArchived || account.openingBalance !== 0)
  const checked = accounts.filter((account) => account.balanceConfirmed).length
  const change = (id: string, patch: Partial<Account>) => update((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === id ? { ...account, ...patch } : account) }))
  const done = accounts.length > 0 && checked === accounts.length
  const sum = total(accounts.map((account) => ({ amount: account.openingBalance })))
  return <Section step={1} title="Сколько сейчас на счетах" done={done}
    total={accounts.length > 0 && money(sum)} meta={progress(checked, accounts.length)}>
    {accounts.length === 0 && <Empty>Счетов пока нет. <Button variant="ghost" size="sm" onClick={onOpenSettings}>Добавить в настройках</Button></Empty>}
    <div className="rows">
      {accounts.map((account) => <div className="row" key={account.id}>
        <div className="row-main"><strong><AccountBadge name={account.name} bank={account.bank} /></strong></div>
        <div className="row-side">
          {/* A checked balance is locked; uncheck it to correct the amount. */}
          <Amount label={`Остаток: ${account.name}`} value={account.openingBalance} readOnly={readOnly || Boolean(account.balanceConfirmed)} className="amount-locked"
            onChange={(openingBalance) => change(account.id, { openingBalance })} />
          {/* What must stay on the account this month (a fee, a reserve); starts from the account setting. */}
          {(!readOnly || Boolean(account.keepAmount)) && <label className="keep-field"><span>Оставить</span>
            <Amount label={`Оставить на счёте: ${account.name}`} value={account.keepAmount ?? 0} readOnly={readOnly} onChange={(keepAmount) => change(account.id, { keepAmount })} /></label>}
          {readOnly
            ? <Badge tone={account.balanceConfirmed ? 'ok' : 'warn'}>{account.balanceConfirmed ? 'Проверено' : 'Не проверено'}</Badge>
            : <Checkbox checked={account.balanceConfirmed ?? false} onChange={(balanceConfirmed) => change(account.id, { balanceConfirmed, balanceDate: balanceConfirmed ? today() : null })}>Проверено</Checkbox>}
        </div>
      </div>)}
    </div>
    {accounts.length > 0 && <div className="total-row"><span>Итого</span><strong className="amount">{money(sum)}</strong></div>}
  </Section>
}
