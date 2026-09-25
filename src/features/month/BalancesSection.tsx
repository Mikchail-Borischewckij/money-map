import { Badge, Button, Checkbox, Empty } from '@/components/ui'
import type { Account, Plan } from '@/lib/domain'
import Amount from './Amount'
import Section from './Section'
import { kindLabel, type UpdatePlan } from './utils'

const today = () => new Date().toISOString().slice(0, 10)

export default function BalancesSection({ plan, readOnly, update, onOpenSettings }: { plan: Plan; readOnly: boolean; update: UpdatePlan; onOpenSettings: () => void }) {
  const accounts = plan.accounts.filter((account) => !account.isArchived || account.openingBalance !== 0)
  const checked = accounts.filter((account) => account.balanceConfirmed).length
  const change = (id: string, patch: Partial<Account>) => update((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === id ? { ...account, ...patch } : account) }))
  return <Section step={1} title="Остатки на счетах"
    meta={accounts.length > 0 && <Badge tone={checked === accounts.length ? 'ok' : 'warn'}>Проверено {checked} из {accounts.length}</Badge>}>
    {accounts.length === 0 && <Empty>Счетов пока нет. <Button variant="ghost" size="sm" onClick={onOpenSettings}>Добавить в настройках</Button></Empty>}
    <div className="rows">
      {accounts.map((account) => <div className="row" key={account.id}>
        <div className="row-main"><strong>{account.name}</strong><span className="row-meta">{kindLabel[account.kind]}</span></div>
        <div className="row-side">
          <Amount label={`Остаток: ${account.name}`} value={account.openingBalance} readOnly={readOnly}
            onChange={(openingBalance) => change(account.id, { openingBalance, balanceConfirmed: true, balanceDate: today() })} />
          {readOnly
            ? <Badge tone={account.balanceConfirmed ? 'ok' : 'warn'}>{account.balanceConfirmed ? 'Проверено' : 'Не проверено'}</Badge>
            : <Checkbox checked={account.balanceConfirmed ?? false} onChange={(balanceConfirmed) => change(account.id, { balanceConfirmed, balanceDate: balanceConfirmed ? today() : null })}>Проверено</Checkbox>}
        </div>
      </div>)}
    </div>
  </Section>
}
