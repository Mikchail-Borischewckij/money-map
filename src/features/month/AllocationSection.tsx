import { Empty, Select } from '@/components/ui'
import type { Account, Allocation, Plan } from '@/lib/domain'
import Amount from './Amount'
import Section from './Section'
import type { UpdatePlan } from './utils'

// Only savings are planned here: whatever is left after payments and savings is the money for living.
export default function AllocationSection({ plan, readOnly, update, accounts, accountName }: { plan: Plan; readOnly: boolean; update: UpdatePlan; accounts: Account[]; accountName: (id: string) => string }) {
  const value = plan.allocations.find((allocation) => allocation.kind === 'savings')
  const set = (patch: Partial<Allocation>) => update((current) => {
    const existing = current.allocations.find((allocation) => allocation.kind === 'savings')
    if (existing) return { ...current, allocations: current.allocations.map((allocation) => allocation === existing ? { ...allocation, ...patch } : allocation) }
    const accountId = patch.accountId ?? (accounts.find((account) => account.kind === 'savings') ?? accounts[0])?.id
    if (!accountId) return current
    return { ...current, allocations: [...current.allocations, { id: crypto.randomUUID(), name: 'Отложить', kind: 'savings', amount: 0, accountId, ...patch }] }
  })
  const options = accounts.map((account) => ({ value: account.id, label: account.name }))
  return <Section step={4} title="Отложить">
    {accounts.length === 0 ? <Empty>Сначала добавьте счёт.</Empty> : <div className="rows">
      <div className="row">
        <div className="row-main"><strong>Отложить</strong><span className="row-meta">{readOnly ? value && accountName(value.accountId) : 'Остальное — на жизнь'}</span></div>
        <div className="row-side row-side-wrap">
          {!readOnly && <Select compact label="Счёт: отложить" placeholder="Счёт" value={value?.accountId ?? ''} options={options} onChange={(accountId) => set({ accountId })} />}
          <Amount label="Отложить" value={value?.amount ?? 0} readOnly={readOnly} onChange={(amount) => set({ amount })} />
        </div>
      </div>
    </div>}
  </Section>
}
