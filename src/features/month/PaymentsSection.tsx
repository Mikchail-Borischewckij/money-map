"use client"

import { useState } from 'react'
import { AddButton, Button, DataTable, Empty } from '@/components/ui'
import type { Account, Payment, Plan } from '@/lib/domain'
import { money } from '@/lib/format'
import OneOffDialog from './OneOffDialog'
import { paymentColumns, paymentRowClass } from './paymentColumns'
import { progress } from './Progress'
import Section from './Section'
import { dayInPlan, paymentToCheck, periodOfPlan, total, type UpdatePlan } from './utils'

// One table of the month's payments; the account filter shows what makes up an account's payments.
export default function PaymentsSection({ plan, readOnly, update, accountTag, accounts, categories, onReset, open, onToggle, done }: {
  plan: Plan; readOnly: boolean; update: UpdatePlan; accountTag: (id: string) => React.ReactNode; accounts: Account[]
  categories: string[]; onReset: (id: string) => void; open: boolean; onToggle: () => void; done: boolean
}) {
  const [adding, setAdding] = useState(false)
  const change = (id: string, patch: Partial<Payment>) => update((current) => ({ ...current, payments: current.payments.map((payment) => payment.id === id ? { ...payment, ...patch } : payment) }))
  const remove = (id: string) => update((current) => ({ ...current, payments: current.payments.filter((payment) => payment.id !== id) }))
  const accountName = (id: string) => plan.accounts.find((account) => account.id === id)?.name ?? 'Счёт удалён'
  const planned = plan.payments.filter((payment) => payment.enabled)
  const unchecked = planned.filter((payment) => !payment.checked).length
  const confirmAll = () => update((current) => ({ ...current, payments: current.payments.map((payment) => paymentToCheck(payment) ? { ...payment, checked: true, amountPending: false } : payment) }))
  return <Section step={3} title="Платежи" open={open} onToggle={onToggle} done={done}
    total={planned.length > 0 && `Всего ${money(total(planned))}`} meta={progress(planned.length - unchecked, planned.length)}
    action={!readOnly && unchecked > 1 && <Button size="sm" variant="ghost" onClick={confirmAll}>Проверить все</Button>}>
    <DataTable label="Платежи" rows={plan.payments} rowKey={(payment) => payment.id} rowClassName={paymentRowClass}
      columns={paymentColumns({ period: periodOfPlan(plan), readOnly, accountTag, accountName, onChange: change, onRemove: remove, onReset })}
      defaultSort={{ key: 'when', dir: 'asc' }}
      search={(payment) => `${payment.name} ${payment.category} ${accountName(payment.accountId)}`}
      actions={!readOnly && <AddButton onClick={() => setAdding(true)} />}
      empty={<Empty>Платежей пока нет. Регулярные платежи добавляются в настройках.</Empty>} />
    {adding && <OneOffDialog kind="payment" plan={plan} accounts={accounts} categories={categories} onClose={() => setAdding(false)}
      onSave={({ name, amount, accountId, day, category }) => {
        update((current) => ({ ...current, payments: [...current.payments, { id: crypto.randomUUID(), name, amount, accountId, category, enabled: true, due: day ? dayInPlan(current, day) : 'в течение месяца' }] }))
        setAdding(false)
      }} />}
  </Section>
}
