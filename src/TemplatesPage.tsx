"use client"

import { useCallback, useEffect, useState } from 'react'
import { toCents } from './api-client'
import type { Account } from './domain'

type Kind = 'income' | 'payment'
type Template = {
  id: string; name: string; default_amount: string; account_id: string; day: number | null
  active_from: string; active_to: string | null; latest_effective_from: string
  category_id?: string | null; is_archived: boolean; version: number
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
    try {
      const response = await fetch(`/api/recurring-${kind === 'income' ? 'incomes' : 'payments'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ name: name.trim(), defaultAmount: toCents(Number(amount.replace(',', '.'))), accountId, day: day ? Number(day) : null, activeFrom: `${effectiveMonth}-01`, activeTo: null, categoryId: kind === 'payment' && categoryId ? categoryId : null }),
      })
      if (!response.ok) throw new Error('Не удалось создать шаблон')
      setName(''); setAmount('0'); setDay(''); setMessage('Шаблон добавлен. Уже созданные месяцы не меняются.')
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
    <section className="page-heading compact"><div><span className="eyebrow">БАЗОВЫЕ ЗНАЧЕНИЯ</span><h1>Регулярные статьи</h1><p>Новые месяцы получают снимки шаблонов. Созданные планы сохраняют свои суммы и исключения.</p></div></section>
    {message && <p className="template-message" role="status">{message}</p>}
    <div className="template-tabs"><button className={kind === 'payment' ? 'active' : ''} onClick={() => setKind('payment')}>Платежи</button><button className={kind === 'income' ? 'active' : ''} onClick={() => setKind('income')}>Доходы</button></div>
    <form className="panel template-form" onSubmit={(event) => void create(event)}>
      <h2>Добавить {kind === 'payment' ? 'платёж' : 'доход'}</h2>
      <label>Название <input required value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Сумма, zł <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>Счёт <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label>День месяца <input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} placeholder="В течение месяца" /></label>
      <label>Действует с месяца <input type="month" value={effectiveMonth} onChange={(event) => setEffectiveMonth(event.target.value)} /></label>
      {kind === 'payment' && <label>Категория <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Без категории</option>{categories.filter((item) => !item.is_archived).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <button className="primary-button" type="submit">Добавить шаблон</button>
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

  async function save(event: React.FormEvent) {
    event.preventDefault()
    try {
      const response = await fetch(`/api/recurring-${kind === 'income' ? 'incomes' : 'payments'}/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ name: name.trim(), defaultAmount: toCents(Number(amount.replace(',', '.'))), accountId, day: day ? Number(day) : null, activeFrom: `${effectiveMonth}-01`, activeTo: activeTo || null, categoryId: kind === 'payment' && categoryId ? categoryId : null, version: item.version }),
      })
      if (!response.ok) throw new Error(response.status === 409 ? 'Шаблон изменился у другого пользователя. Ваш ввод остался на экране; обновите список для сравнения.' : 'Не удалось сохранить шаблон')
      onMessage('Базовое значение сохранено. Созданные месяцы не изменены.')
      await onSaved()
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Ошибка') }
  }

  return <form className="panel template-row" onSubmit={(event) => void save(event)}>
    <label>Название <input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Сумма, zł <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    <label>Счёт <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
    <label>День <input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} /></label>
    {kind === 'payment' && <label>Категория <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Без категории</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
    <label>Изменить базу с месяца <input type="month" value={effectiveMonth} onChange={(event) => setEffectiveMonth(event.target.value)} /></label>
    <label>Завершить после даты <input type="date" value={activeTo} onChange={(event) => setActiveTo(event.target.value)} /></label>
    <button className="secondary-button" type="submit">Сохранить шаблон</button>
  </form>
}
