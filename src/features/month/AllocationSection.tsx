import { Empty, Select } from '@/components/ui'
import type { Account, Allocation, Plan } from '@/lib/domain'
import Amount from './Amount'
import Section from './Section'
import type { UpdatePlan } from './utils'

type Kind = 'living' | 'savings'
const titles: Record<Kind, string> = { living: 'На жизнь', savings: 'Отложить' }

export default function AllocationSection({ plan, readOnly, update, accounts, accountName }: { plan: Plan; readOnly: boolean; update: UpdatePlan; accounts: Account[]; accountName: (id: string) => string }) {
  const set = (kind: Kind, patch: Partial<Allocation>) => update((current) => {
    const existing = current.allocations.find((allocation) => allocation.kind === kind)
    if (existing) return { ...current, allocations: current.allocations.map((allocation) => allocation.kind === kind ? { ...allocation, ...patch } : allocation) }
    const accountId = patch.accountId ?? accounts[0]?.id
    if (!accountId) return current
    return { ...current, allocations: [...current.allocations, { id: crypto.randomUUID(), name: titles[kind], kind, amount: 0, accountId, ...patch }] }
  })
  const options = accounts.map((account) => ({ value: account.id, label: account.name }))
  const line = (kind: Kind) => {
    const value = plan.allocations.find((allocation) => allocation.kind === kind)
    return <div className="row" key={kind}>
      <div className="row-main"><strong>{titles[kind]}</strong>{readOnly && value && <span className="row-meta">{accountName(value.accountId)}</span>}</div>
      <div className="row-side row-side-wrap">
        {!readOnly && <Select compact label={`Счёт: ${titles[kind]}`} placeholder="Счёт" value={value?.accountId ?? ''} options={options} onChange={(accountId) => set(kind, { accountId })} />}
        <Amount label={titles[kind]} value={value?.amount ?? 0} readOnly={readOnly} onChange={(amount) => set(kind, { amount })} />
      </div>
    </div>
  }
  return <Section step={4} title="Распределение">
    {accounts.length === 0 ? <Empty>Сначала добавьте счёт.</Empty> : <div className="rows">{line('living')}{line('savings')}</div>}
  </Section>
}
