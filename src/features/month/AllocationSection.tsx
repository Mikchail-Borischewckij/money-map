import { Plus } from 'lucide-react'
import { Button, Select } from '@/components/ui'
import type { Account, Allocation, Plan } from '@/lib/domain'
import Amount from './Amount'
import Section from './Section'
import type { UpdatePlan } from './utils'

export const savingsOf = (plan: Plan) => plan.allocations.find((allocation) => allocation.kind === 'savings')

// Optional: most months nothing is set aside. Whatever is left after payments and savings is the money for living.
export default function AllocationSection({ plan, step, readOnly, update, accounts, accountName }: { plan: Plan; step: number; readOnly: boolean; update: UpdatePlan; accounts: Account[]; accountName: (id: string) => string }) {
  const value = savingsOf(plan)
  if (accounts.length === 0 || (!value && readOnly)) return null
  if (!value) return <Button variant="ghost" className="add-saving" icon={<Plus size={16} />} onClick={() => update((current) => {
    const accountId = (accounts.find((account) => account.kind === 'savings') ?? accounts[0]).id
    return { ...current, allocations: [...current.allocations, { id: crypto.randomUUID(), name: 'Отложить', kind: 'savings', amount: 0, accountId }] }
  })}>Отложить</Button>
  const set = (patch: Partial<Allocation>) => update((current) => ({ ...current, allocations: current.allocations.map((allocation) => allocation.id === value.id ? { ...allocation, ...patch } : allocation) }))
  const remove = () => update((current) => ({ ...current, allocations: current.allocations.filter((allocation) => allocation.id !== value.id) }))
  return <Section step={step} title="Отложить" action={!readOnly && <Button size="sm" variant="ghost" onClick={remove}>Не откладывать</Button>}>
    <div className="rows">
      <div className="row">
        <div className="row-main"><strong>{readOnly ? accountName(value.accountId) : 'На счёт'}</strong><span className="row-meta">Остальное — на жизнь</span></div>
        <div className="row-side row-side-wrap">
          {!readOnly && <Select compact label="Счёт: отложить" placeholder="Счёт" value={value.accountId} options={accounts.map((account) => ({ value: account.id, label: account.name }))} onChange={(accountId) => set({ accountId })} />}
          <Amount label="Отложить" value={value.amount} readOnly={readOnly} onChange={(amount) => set({ amount })} />
        </div>
      </div>
    </div>
  </Section>
}
