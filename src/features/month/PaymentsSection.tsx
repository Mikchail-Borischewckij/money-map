"use client"

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Empty } from '@/components/ui'
import type { Account, Payment, Plan } from '@/lib/domain'
import { money } from '@/lib/format'
import OneOffDialog from './OneOffDialog'
import PaymentRow from './PaymentRow'
import Section from './Section'
import { dayInPlan, periodOfPlan, total, type UpdatePlan } from './utils'

export default function PaymentsSection({ plan, readOnly, update, accountTag, accounts, categories, onReset }: { plan: Plan; readOnly: boolean; update: UpdatePlan; accountTag: (id: string) => React.ReactNode; accounts: Account[]; categories: string[]; onReset: (id: string) => void }) {
  const [adding, setAdding] = useState(false)
  const change = (id: string, patch: Partial<Payment>) => update((current) => ({ ...current, payments: current.payments.map((payment) => payment.id === id ? { ...payment, ...patch } : payment) }))
  const remove = (id: string) => update((current) => ({ ...current, payments: current.payments.filter((payment) => payment.id !== id) }))
  const regular = plan.payments.filter((payment) => payment.enabled && payment.recurringPaymentId)
  const once = plan.payments.filter((payment) => payment.enabled && !payment.recurringPaymentId)
  const excluded = plan.payments.filter((payment) => !payment.enabled)
  const row = (payment: Payment) => <PaymentRow key={payment.id} payment={payment} period={periodOfPlan(plan)} readOnly={readOnly} accountTag={accountTag}
    onChange={(patch) => change(payment.id, patch)} onRemove={() => remove(payment.id)} onReset={() => onReset(payment.id)} />
  return <Section step={3} title="Платежи" meta={<span>Всего {money(total([...regular, ...once]))}</span>}
    action={!readOnly && <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Разовый платёж</Button>}>
    {plan.payments.length === 0 && <Empty>Платежей нет. Регулярные платежи добавляются в настройках.</Empty>}
    {regular.length > 0 && <div className="group"><div className="group-head"><span>Регулярные</span><span>{money(total(regular))}</span></div><div className="rows">{regular.map(row)}</div></div>}
    {once.length > 0 && <div className="group"><div className="group-head"><span>Разовые</span><span>{money(total(once))}</span></div><div className="rows">{once.map(row)}</div></div>}
    {excluded.length > 0 && <details className="group group-excluded">
      <summary className="group-head"><span>Не платим в этом месяце · {excluded.length}</span><span>{money(total(excluded))}</span></summary>
      <div className="rows">{excluded.map(row)}</div>
    </details>}
    {adding && <OneOffDialog kind="payment" plan={plan} accounts={accounts} categories={categories} onClose={() => setAdding(false)}
      onSave={({ name, amount, accountId, day, category }) => {
        update((current) => ({ ...current, payments: [...current.payments, { id: crypto.randomUUID(), name, amount, accountId, category, enabled: true, due: day ? dayInPlan(current, day) : 'в течение месяца' }] }))
        setAdding(false)
      }} />}
  </Section>
}
