import { AccountBadge, Badge, Button, Checkbox, Empty, Select } from '@/components/ui'
import { accountHue } from '@/lib/account-color'
import type { Account, Plan } from '@/lib/domain'
import { dayLabel, money } from '@/lib/format'
import { countWeekdaysInPeriod, periodDays } from '@/lib/period'
import Amount from './Amount'
import Section from './Section'
import { periodOfPlan, round, total, type UpdatePlan } from './utils'

const today = () => new Date().toISOString().slice(0, 10)

export default function BalancesSection({ plan, readOnly, update, onOpenSettings }: { plan: Plan; readOnly: boolean; update: UpdatePlan; onOpenSettings: () => void }) {
  const accounts = plan.accounts.filter((account) => !account.isArchived || account.openingBalance !== 0)
  const checked = accounts.filter((account) => account.balanceConfirmed).length
  const period = periodOfPlan(plan)
  // A new balances date recounts weekly payments that still follow the calendar; counts changed by hand stay.
  const setDate = (balancesOn: string) => update((current) => {
    const before = periodOfPlan(current)
    const after = { ...before, from: balancesOn }
    return { ...current, balancesOn, payments: current.payments.map((payment) => {
      if (payment.unitPrice == null || payment.quantity == null || !payment.weekdays || payment.quantity !== countWeekdaysInPeriod(before, payment.weekdays)) return payment
      const quantity = countWeekdaysInPeriod(after, payment.weekdays)
      return { ...payment, quantity, amount: round(payment.unitPrice * quantity) }
    }) }
  })
  const dateOptions = periodDays(period).map((day) => ({ value: day, label: dayLabel(day) }))
  const change = (id: string, patch: Partial<Account>) => update((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === id ? { ...account, ...patch } : account) }))
  const date = plan.balancesOn ?? dateOptions[0]?.value
  const done = accounts.length > 0 && checked === accounts.length
  const sum = total(accounts.map((account) => ({ amount: account.openingBalance })))
  return <Section step={1} title="Остатки на счетах" done={done}
    meta={accounts.length > 0 && (done ? <span>{money(sum)}</span> : <Badge tone="warn">Проверено {checked} из {accounts.length}</Badge>)}
    action={readOnly ? date && <span className="section-meta">на {dayLabel(date)}</span>
      : <div className="balances-date"><span>на</span><Select compact label="Остатки на дату" value={date ?? ''} options={dateOptions} onChange={setDate} /></div>}>
    {accounts.length === 0 && <Empty>Счетов пока нет. <Button variant="ghost" size="sm" onClick={onOpenSettings}>Добавить в настройках</Button></Empty>}
    <div className="rows">
      {accounts.map((account) => <div className="row" key={account.id}>
        <div className="row-main"><strong><AccountBadge name={account.name} hue={accountHue(plan.accounts, account.id)} /></strong></div>
        <div className="row-side">
          {/* A checked balance is locked; uncheck it to correct the amount. */}
          <Amount label={`Остаток: ${account.name}`} value={account.openingBalance} readOnly={readOnly || Boolean(account.balanceConfirmed)} className="amount-locked"
            onChange={(openingBalance) => change(account.id, { openingBalance })} />
          {readOnly
            ? <Badge tone={account.balanceConfirmed ? 'ok' : 'warn'}>{account.balanceConfirmed ? 'Проверено' : 'Не проверено'}</Badge>
            : <Checkbox checked={account.balanceConfirmed ?? false} onChange={(balanceConfirmed) => change(account.id, { balanceConfirmed, balanceDate: balanceConfirmed ? today() : null })}>Проверено</Checkbox>}
        </div>
      </div>)}
    </div>
    {accounts.length > 0 && <div className="total-row"><span>Итого</span><strong className="amount">{money(sum)}</strong></div>}
  </Section>
}
