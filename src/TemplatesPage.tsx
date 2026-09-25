"use client"

import { useCallback, useEffect, useState } from 'react'
import { toCents } from './api-client'
import type { Account } from './domain'
import { WeekdayPicker } from './fields'
import { weekdayLabel, type PaymentSchedule } from './schedule'

type Kind = 'income' | 'payment'
type Template = {
  id: string; name: string; default_amount: string; account_id: string; day: number | null
  active_from: string; active_to: string | null; latest_effective_from: string
  category_id?: string | null; is_archived: boolean; version: number
  schedule?: PaymentSchedule; weekdays?: number[] | null
}
type Category = { id: string; name: string; is_archived: boolean; version: number }

export default function TemplatesPage({ accounts, month, csrfToken }: { accounts: Account[]; month: string; csrfToken: string }) {
  const [kind, setKind] = useState<Kind>('payment')
  const [templates, setTemplates] = useState<Record<Kind, Template[]>>({ income: [], payment: [] })
  const [categories, setCategories] = useState<Category[]>([])
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('0')
  const [accountId, setAccountId] = useState(accounts.find((account) => !account.isArchived)?.id ?? '')
  const [day, setDay] = useState('')
  const [effectiveMonth, setEffectiveMonth] = useState(month)
  const [categoryId, setCategoryId] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [schedule, setSchedule] = useState<PaymentSchedule>('monthly')
  const [weekdays, setWeekdays] = useState<number[]>([])

  const refresh = useCallback(async () => {
    const responses = await Promise.all([fetch('/api/recurring-incomes'), fetch('/api/recurring-payments'), fetch('/api/categories')])
    if (responses.some((response) => !response.ok)) throw new Error('Не удалось загрузить справочники')
    const [income, payment, category] = await Promise.all(responses.map((response) => response.json()))
    setTemplates({ income, payment })
    setCategories(category)
  }, [])
  useEffect(() => { void refresh().catch((error) => setMessage(error.message)) }, [refresh])

  async function create(event: React.FormEvent) {
    event.preventDefault()
    if (!accountId || !name.trim()) return
    const weekly = kind === 'payment' && schedule === 'weekly'
    if (weekly && weekdays.length === 0) { setMessage('Выберите хотя бы один день недели.'); return }
    try {
      const response = await fetch(`/api/recurring-${kind === 'income' ? 'incomes' : 'payments'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ name: name.trim(), defaultAmount: toCents(Number(amount.replace(',', '.'))), accountId, day: day && !weekly ? Number(day) : null, activeFrom: `${effectiveMonth}-01`, activeTo: null, categoryId: kind === 'payment' && categoryId ? categoryId : null, ...(kind === 'payment' ? { schedule: weekly ? 'weekly' : 'monthly', weekdays: weekly ? weekdays : null } : {}) }),
      })
      if (!response.ok) throw new Error('Не удалось создать шаблон')
      setName(''); setAmount('0'); setDay(''); setWeekdays([]); setMessage('Добавлено в справочник. Появится в месяцах, которые будут созданы начиная с выбранного. Уже созданные месяцы не меняются: чтобы перенести его туда, нажмите «Обновить из справочника» в нужном месяце.')
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Ошибка') }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault()
    if (!newCategory.trim()) return
    const response = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ name: newCategory.trim() }) })
    if (!response.ok) { setMessage('Не удалось добавить категорию'); return }
    setNewCategory(''); await refresh()
  }

  return <>
    <section className="page-heading compact"><div><span className="eyebrow">БАЗОВЫЕ ЗНАЧЕНИЯ</span><h1>Справочник</h1><p>Регулярные платежи и доходы, из которых создаётся каждый новый месяц. Уже созданные месяцы не меняются.</p></div></section>
    {message && <p className="template-message" role="status">{message}</p>}
    <div className="template-tabs"><button className={kind === 'payment' ? 'active' : ''} onClick={() => setKind('payment')}>Платежи</button><button className={kind === 'income' ? 'active' : ''} onClick={() => setKind('income')}>Доходы</button></div>
    <form className="panel template-form" onSubmit={(event) => void create(event)}>
      <h2>Добавить {kind === 'payment' ? 'регулярный платёж' : 'регулярный доход'}</h2>
      {kind === 'payment' && <ScheduleSelect value={schedule} onChange={setSchedule} />}
      <label>Название <input required value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>{kind === 'payment' && schedule === 'weekly' ? 'Цена за один раз, zł' : 'Сумма, zł'} <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>Счёт <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      {kind === 'payment' && schedule === 'weekly'
        ? <div className="form-wide"><span className="field-label">Дни недели</span><WeekdayPicker value={weekdays} onChange={setWeekdays} /></div>
        : <label>День месяца <input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} placeholder="В течение месяца" /></label>}
      <label>Действует с месяца <input type="month" value={effectiveMonth} onChange={(event) => setEffectiveMonth(event.target.value)} /></label>
      {kind === 'payment' && <label>Категория <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Без категории</option>{categories.filter((item) => !item.is_archived).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <button className="primary-button" type="submit">Добавить в справочник</button>
    </form>
    <section className="template-list">{templates[kind].map((template) => <TemplateRow key={template.id} item={template} kind={kind} accounts={accounts} categories={categories} csrfToken={csrfToken} onSaved={refresh} onMessage={setMessage} />)}</section>
    <form className="panel category-form" onSubmit={(event) => void addCategory(event)}><h2>Категории</h2><div><input aria-label="Новая категория" placeholder="Новая категория" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /><button className="secondary-button" type="submit">Добавить</button></div></form>
    <div className="category-list">{categories.map((category) => <CategoryRow key={category.id} category={category} csrfToken={csrfToken} onSaved={refresh} onMessage={setMessage} />)}</div>
  </>
}

function CategoryRow({ category, csrfToken, onSaved, onMessage }: { category: Category; csrfToken: string; onSaved: () => Promise<void>; onMessage: (message: string) => void }) {
  const [name, setName] = useState(category.name)
  async function save(isArchived: boolean) {
    const response = await fetch(`/api/categories/${category.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ name: name.trim(), isArchived, version: category.version }) })
    if (!response.ok) { onMessage(response.status === 409 ? 'Категория изменена другим пользователем. Обновите список.' : 'Не удалось сохранить категорию.'); return }
    onMessage(isArchived ? 'Категория архивирована.' : 'Категория сохранена.')
    await onSaved()
  }
  return <div className="panel category-row"><input aria-label="Название категории" value={name} onChange={(event) => setName(event.target.value)} /><span>{category.is_archived ? 'Архив' : ''}</span><button className="secondary-button" type="button" onClick={() => void save(category.is_archived)}>Сохранить</button>{!category.is_archived && <button className="text-button" type="button" onClick={() => void save(true)}>Архивировать</button>}</div>
}

function TemplateRow({ item, kind, accounts, categories, csrfToken, onSaved, onMessage }: { item: Template; kind: Kind; accounts: Account[]; categories: Category[]; csrfToken: string; onSaved: () => Promise<void>; onMessage: (message: string) => void }) {
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(String(Number(item.default_amount) / 100))
  const [accountId, setAccountId] = useState(item.account_id)
  const [day, setDay] = useState(item.day ? String(item.day) : '')
  const [effectiveMonth, setEffectiveMonth] = useState(item.latest_effective_from.slice(0, 7))
  const [activeTo, setActiveTo] = useState(item.active_to ?? '')
  const [categoryId, setCategoryId] = useState(item.category_id ?? '')
  const [schedule, setSchedule] = useState<PaymentSchedule>(item.schedule ?? 'monthly')
  const [weekdays, setWeekdays] = useState<number[]>(item.weekdays ?? [])
  const weekly = kind === 'payment' && schedule === 'weekly'

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (weekly && weekdays.length === 0) { onMessage('Выберите хотя бы один день недели.'); return }
    try {
      const response = await fetch(`/api/recurring-${kind === 'income' ? 'incomes' : 'payments'}/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ name: name.trim(), defaultAmount: toCents(Number(amount.replace(',', '.'))), accountId, day: day && !weekly ? Number(day) : null, activeFrom: `${effectiveMonth}-01`, activeTo: activeTo || null, categoryId: kind === 'payment' && categoryId ? categoryId : null, version: item.version, ...(kind === 'payment' ? { schedule: weekly ? 'weekly' : 'monthly', weekdays: weekly ? weekdays : null } : {}) }),
      })
      if (!response.ok) throw new Error(response.status === 409 ? 'Шаблон изменился у другого пользователя. Ваш ввод остался на экране; обновите список для сравнения.' : 'Не удалось сохранить шаблон')
      onMessage('Сохранено. Уже созданные месяцы не изменены — их можно обновить кнопкой «Обновить из справочника».')
      await onSaved()
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Ошибка') }
  }

  const ended = item.active_to !== null && item.active_to < new Date().toISOString().slice(0, 10)
  const label = kind === 'payment' && item.schedule === 'weekly' && item.weekdays ? `Каждую неделю: ${weekdayLabel(item.weekdays)}` : item.day ? `Каждый месяц, ${item.day}-го` : 'Каждый месяц'
  return <form className={ended ? 'panel template-row ended' : 'panel template-row'} onSubmit={(event) => void save(event)}>
    <div className="template-row-head form-wide"><strong>{item.name}</strong><span className="pill">{label}{ended ? ' · завершён' : ''}</span></div>
    {kind === 'payment' && <ScheduleSelect value={schedule} onChange={setSchedule} />}
    <label>Название <input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>{weekly ? 'Цена за один раз, zł' : 'Сумма, zł'} <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    <label>Счёт <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.filter((account) => !account.isArchived || account.id === item.account_id).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
    {weekly
      ? <div className="form-wide"><span className="field-label">Дни недели</span><WeekdayPicker value={weekdays} onChange={setWeekdays} /></div>
      : <label>День месяца <input type="number" min="1" max="31" placeholder="В течение месяца" value={day} onChange={(event) => setDay(event.target.value)} /></label>}
    {kind === 'payment' && <label>Категория <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Без категории</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
    <label>Изменения действуют с месяца <input type="month" value={effectiveMonth} onChange={(event) => setEffectiveMonth(event.target.value)} /></label>
    <label>Больше не нужен после <input type="date" value={activeTo} onChange={(event) => setActiveTo(event.target.value)} /></label>
    <button className="secondary-button" type="submit">Сохранить</button>
  </form>
}

function ScheduleSelect({ value, onChange }: { value: PaymentSchedule; onChange: (value: PaymentSchedule) => void }) {
  return <div className="segmented form-wide" role="radiogroup" aria-label="Как часто">
    {([['monthly', 'Каждый месяц'], ['weekly', 'По дням недели']] as const).map(([option, label]) =>
      <button key={option} type="button" role="radio" aria-checked={value === option} className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{label}</button>)}
  </div>
}
