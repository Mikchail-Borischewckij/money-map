"use client"

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Empty, Segmented } from '@/components/ui'
import type { Account, Payment, Plan } from '@/lib/domain'
import { money } from '@/lib/format'
import OneOffDialog from './OneOffDialog'
import PaymentRow from './PaymentRow'
import Section from './Section'
import { dayInPlan, periodOfPlan, total, type UpdatePlan } from './utils'

const ALL = 'all'

// One table of the month's payments; the account filter shows what makes up an account's "Необходимо на платежи".
export default function PaymentsSection({ plan, readOnly, update, accountTag, accounts, categories, onReset }: { plan: Plan; readOnly: boolean; update: UpdatePlan; accountTag: (id: string) => React.ReactNode; accounts: Account[]; categories: string[]; onReset: (id: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState(ALL)
  const change = (id: string, patch: Partial<Payment>) => update((current) => ({ ...current, payments: current.payments.map((payment) => payment.id === id ? { ...payment, ...patch } : payment) }))
  const remove = (id: string) => update((current) => ({ ...current, payments: current.payments.filter((payment) => payment.id !== id) }))
  const used = plan.accounts.filter((account) => plan.payments.some((payment) => payment.accountId === account.id))
  const accountId = used.some((account) => account.id === filter) ? filter : ALL
  const shown = plan.payments.filter((payment) => accountId === ALL || payment.accountId === accountId)
  // Payments skipped this month stay in place, struck through, and are left out of the totals.
  const regular = shown.filter((payment) => payment.recurringPaymentId)
  const once = shown.filter((payment) => !payment.recurringPaymentId)
  const sum = (items: Payment[]) => total(items.filter((payment) => payment.enabled))
  const row = (payment: Payment) => <PaymentRow key={payment.id} payment={payment} period={periodOfPlan(plan)} readOnly={readOnly} accountTag={accountTag}
    onChange={(patch) => change(payment.id, patch)} onRemove={() => remove(payment.id)} onReset={() => onReset(payment.id)} />
  const group = (title: string, items: Payment[]) => items.length > 0 && <tbody>
    <tr className="group-row"><th colSpan={3}>{title}</th><th className="num">{money(sum(items))}</th><th colSpan={2} /></tr>
    {items.map(row)}
  </tbody>
  const planned = plan.payments.filter((payment) => payment.enabled)
  const unchecked = planned.filter((payment) => !payment.checked).length
  return <Section step={3} title="Платежи" done={planned.length > 0 && unchecked === 0}
    meta={<span>Всего {money(total(planned))}{unchecked > 0 && ` · не проверено ${unchecked}`}</span>}
    action={!readOnly && <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Разовый платёж</Button>}>
    {plan.payments.length === 0 && <Empty>Платежей нет. Регулярные платежи добавляются в настройках.</Empty>}
    {used.length > 1 && <Segmented size="sm" label="Счёт" value={accountId} onChange={setFilter}
      options={[{ value: ALL, label: 'Все счета' }, ...used.map((account) => ({ value: account.id, label: account.name }))]} />}
    {plan.payments.length > 0 && <div className="table-scroll"><table className="data-table payments-table">
      <thead><tr><th>Платёж</th><th className="col-opt">Счёт</th><th className="col-opt">Когда</th><th className="num">Сумма</th><th className="col-check">Проверено</th><th className="actions"><span className="sr-only">Действия</span></th></tr></thead>
      {group('Регулярные', regular)}
      {group('Разовые', once)}
      {regular.length + once.length === 0 && <tbody><tr><td colSpan={6} className="muted">Платежей с этого счёта нет.</td></tr></tbody>}
      <tfoot><tr><th colSpan={3}>{accountId === ALL ? 'Итого' : 'Итого по счёту'}</th><th className="num">{money(sum(shown))}</th><th colSpan={2} /></tr></tfoot>
    </table></div>}
    {adding && <OneOffDialog kind="payment" plan={plan} accounts={accounts} categories={categories} onClose={() => setAdding(false)}
      onSave={({ name, amount, accountId, day, category }) => {
        update((current) => ({ ...current, payments: [...current.payments, { id: crypto.randomUUID(), name, amount, accountId, category, enabled: true, due: day ? dayInPlan(current, day) : 'в течение месяца' }] }))
        setAdding(false)
      }} />}
  </Section>
}
