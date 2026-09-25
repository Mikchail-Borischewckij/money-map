"use client"

import { useEffect, useState } from 'react'
import { Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { Payment, Plan } from './domain'
import { AmountInput } from './fields'
import { countWeekdays, weekdayLabel } from './schedule'

type Category = { id: string; name: string; is_archived: boolean }

const money = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(amount)
const total = (payments: Payment[]) => payments.reduce((sum, payment) => sum + payment.amount, 0)
const round = (value: number) => Math.round(value * 100) / 100
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
const dayInMonth = (month: string, day: number) => {
  const [year, number] = month.split('-').map(Number)
  return `${month}-${String(Math.min(day, new Date(Date.UTC(year, number, 0)).getUTCDate())).padStart(2, '0')}`
}

function scheduleLabel(payment: Payment) {
  if (!payment.recurringPaymentId) return 'Только в этом месяце'
  if (payment.schedule === 'weekly' && payment.weekdays) return `Каждую неделю: ${weekdayLabel(payment.weekdays)}`
  return isDate(payment.due) ? `Каждый месяц, ${Number(payment.due.slice(8))}-го` : 'Каждый месяц'
}

export default function PaymentsPage({ plan, onAdd, onChange, onRemove, onReset, onOpenDirectory }: {
  plan: Plan
  onAdd: (payment: Payment) => void
  onChange: (id: string, patch: Partial<Payment>) => void
  onRemove: (id: string) => void
  onReset: (id: string) => void
  onOpenDirectory: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  useEffect(() => { void fetch('/api/categories').then((response) => response.ok ? response.json() : []).then(setCategories).catch(() => setCategories([])) }, [])

  const regular = plan.payments.filter((payment) => payment.enabled && payment.recurringPaymentId)
  const once = plan.payments.filter((payment) => payment.enabled && !payment.recurringPaymentId)
  const excluded = plan.payments.filter((payment) => !payment.enabled)
  const row = (payment: Payment) => <PaymentRow key={payment.id} payment={payment} accounts={plan.accounts} month={plan.month}
    onChange={(patch) => onChange(payment.id, patch)} onRemove={() => onRemove(payment.id)} onReset={() => onReset(payment.id)} />

  return <>
    <section className="page-heading compact"><div><span className="eyebrow">ТЕКУЩИЙ МЕСЯЦ</span><h1>Платежи месяца</h1><p>Изменения здесь касаются только этого месяца. Регулярные платежи каждый новый месяц создаются заново из справочника.</p></div>
      <button className="primary-button" onClick={() => { setAdding(true); setMessage('') }}><Plus />Разовый платёж</button></section>
    {message && <p className="template-message" role="status">{message}</p>}
    {adding && <PaymentForm plan={plan} categories={categories} onCancel={() => setAdding(false)} onOpenDirectory={onOpenDirectory}
      onSaved={(payment) => { onAdd(payment); setAdding(false); setMessage('Разовый платёж добавлен только в этот месяц.') }} />}
    <PaymentGroup title="Регулярные" hint="Из справочника: каждый месяц или по дням недели" payments={regular}>{regular.map(row)}</PaymentGroup>
    <PaymentGroup title="Разовые в этом месяце" hint="Есть только в этом месяце и не переходят в следующий" payments={once}>{once.map(row)}</PaymentGroup>
    {excluded.length > 0 && <details className="panel payment-group excluded-group">
      <summary><span><strong>Исключены в этом месяце</strong><small>Не входят в сумму и в переводы</small></span><span className="pill">{excluded.length}</span></summary>
      <div className="ledger-list">{excluded.map(row)}</div>
    </details>}
  </>
}

function PaymentGroup({ title, hint, payments, children }: { title: string; hint: string; payments: Payment[]; children: React.ReactNode }) {
  return <section className="panel payment-group">
    <div className="payment-group-head"><div><h2>{title}</h2><small>{hint}</small></div><strong>{money(total(payments))}</strong></div>
    <div className="ledger-list">{children}</div>
    {payments.length === 0 && <div className="empty-state">Нет платежей</div>}
  </section>
}

function PaymentRow({ payment, accounts, month, onChange, onRemove, onReset }: {
  payment: Payment; accounts: Plan['accounts']; month: string
  onChange: (patch: Partial<Payment>) => void; onRemove: () => void; onReset: () => void
}) {
  const perUnit = payment.unitPrice != null && payment.quantity != null
  const setUnits = (unitPrice: number, quantity: number) => onChange({ unitPrice, quantity, amount: round(unitPrice * quantity) })
  return <div className={payment.enabled ? 'payment-row' : 'payment-row excluded'}>
    <div className="ledger-main">
      <input aria-label="Название платежа" value={payment.name} onChange={(event) => onChange({ name: event.target.value })} />
      <span className="schedule-badge">{scheduleLabel(payment)}</span>
      <div className="row-details">
        <input aria-label="Категория" placeholder="Категория" value={payment.category} onChange={(event) => onChange({ category: event.target.value })} />
        {payment.schedule !== 'weekly' && <input aria-label="Дата платежа" type="date" min={`${month}-01`} max={dayInMonth(month, 31)} value={isDate(payment.due) ? payment.due : ''} onChange={(event) => onChange({ due: event.target.value || 'в течение месяца' })} />}
      </div>
      {perUnit && <div className="unit-line">
        <input aria-label="Количество" type="number" min="0" max="1000" value={payment.quantity ?? 0} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity >= 0) setUnits(payment.unitPrice ?? 0, quantity) }} />
        <span>раз ×</span>
        <div className="amount-input"><AmountInput label="Цена за раз" value={payment.unitPrice ?? 0} onChange={(unitPrice) => setUnits(unitPrice, payment.quantity ?? 0)} /><span>zł</span></div>
        {payment.weekdays && <small>по календарю: {countWeekdays(month, payment.weekdays)}</small>}
      </div>}
    </div>
    <select aria-label="Счёт платежа" value={payment.accountId} onChange={(event) => onChange({ accountId: event.target.value })}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
    {perUnit ? <strong className="payment-total">{money(payment.amount)}</strong>
      : <div className="amount-input"><AmountInput label="Сумма платежа" value={payment.amount} onChange={(amount) => onChange({ amount })} /><span>zł</span></div>}
    <div className="payment-actions">
      {payment.enabled
        ? <button className="text-button" type="button" onClick={() => onChange({ enabled: false })}><X />Исключить в этом месяце</button>
        : <>
          <input aria-label="Причина исключения" placeholder="Причина, например «уже оплачено»" maxLength={200} value={payment.exclusionReason ?? ''} onChange={(event) => onChange({ exclusionReason: event.target.value })} />
          <button className="text-button" type="button" onClick={() => onChange({ enabled: true, exclusionReason: '' })}><RotateCcw />Вернуть в месяц</button>
        </>}
      {payment.recurringPaymentId
        ? <button className="reset-link" type="button" onClick={onReset}>Вернуть значения из справочника</button>
        : <button className="text-button danger" type="button" onClick={onRemove}><Trash2 />Удалить</button>}
    </div>
  </div>
}

function PaymentForm({ plan, categories, onCancel, onSaved, onOpenDirectory }: {
  plan: Plan; categories: Category[]
  onCancel: () => void; onSaved: (payment: Payment) => void; onOpenDirectory: () => void
}) {
  const accounts = plan.accounts.filter((account) => !account.isArchived)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState('')
  const category = categories.find((item) => item.id === categoryId)?.name ?? ''

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !accountId) return
    onSaved({ id: crypto.randomUUID(), name: name.trim(), accountId, enabled: true, category, amount, due: date || 'в течение месяца' })
  }

  return <form className="panel payment-form" onSubmit={submit}>
    <h2 className="form-wide">Разовый платёж в этом месяце</h2>
    <label>Название <input required value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Сумма, zł <AmountInput label="Сумма" value={amount} onChange={setAmount} /></label>
    <label>Счёт <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
    <label>Категория <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Без категории</option>{categories.filter((item) => !item.is_archived).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Дата (необязательно) <input type="date" min={`${plan.month}-01`} max={dayInMonth(plan.month, 31)} value={date} onChange={(event) => setDate(event.target.value)} /></label>
    <p className="form-wide form-note">Платёж повторяется каждый месяц или по дням недели? Добавьте его в <button type="button" className="link-button" onClick={onOpenDirectory}>справочник</button>.</p>
    <div className="form-actions"><button className="primary-button" type="submit">Добавить</button><button className="secondary-button" type="button" onClick={onCancel}>Отмена</button></div>
  </form>
}
