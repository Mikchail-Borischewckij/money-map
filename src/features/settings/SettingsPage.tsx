"use client"

import { useCallback, useEffect, useState } from 'react'
import { Segmented, type Option } from '@/components/ui'
import AccountsTab from './AccountsTab'
import CategoriesTab from './CategoriesTab'
import TemplatesTab from './TemplatesTab'
import type { AccountRow, Category, Template } from './types'

type Tab = 'accounts' | 'payments' | 'incomes' | 'categories'
const tabs: Option<Tab>[] = [{ value: 'accounts', label: 'Счета' }, { value: 'payments', label: 'Платежи' }, { value: 'incomes', label: 'Доходы' }, { value: 'categories', label: 'Категории' }]

export default function SettingsPage({ csrfToken, openMonth, onChanged }: { csrfToken: string; openMonth: string | null; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>('accounts')
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [templates, setTemplates] = useState<{ payments: Template[]; incomes: Template[] }>({ payments: [], incomes: [] })
  const [categories, setCategories] = useState<Category[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const responses = await Promise.all(['/api/accounts', '/api/recurring-payments', '/api/recurring-incomes', '/api/categories'].map((url) => fetch(url, { cache: 'no-store' })))
    if (responses.some((response) => !response.ok)) throw new Error('Не удалось загрузить настройки.')
    const [accountRows, payments, incomes, categoryRows] = await Promise.all(responses.map((response) => response.json()))
    setAccounts(accountRows); setTemplates({ payments, incomes }); setCategories(categoryRows)
  }, [])
  useEffect(() => { refresh().catch((failure: Error) => setError(failure.message)) }, [refresh])

  // Every change reloads the lists; the open month is told so it can show a new account right away.
  const run = async (action: () => Promise<unknown>, done: string) => {
    setError(''); setMessage('')
    try { await action(); await refresh(); onChanged(); setMessage(done) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Ошибка') }
  }
  const monthHint = openMonth ? ' В открытый месяц — кнопкой «Обновить из настроек».' : ''

  return <div className="page">
    <header className="page-head"><h1>Настройки</h1></header>
    <Segmented label="Раздел настроек" value={tab} options={tabs} onChange={(value) => { setTab(value); setMessage(''); setError('') }} />
    {message && <p className="toast" role="status">{message}</p>}
    {error && <p className="toast toast-error" role="alert">{error}</p>}
    {tab === 'accounts' && <AccountsTab accounts={accounts} csrfToken={csrfToken} run={run} />}
    {tab === 'payments' && <TemplatesTab kind="payment" items={templates.payments} accounts={accounts} categories={categories} csrfToken={csrfToken} run={run} hint={monthHint} />}
    {tab === 'incomes' && <TemplatesTab kind="income" items={templates.incomes} accounts={accounts} categories={categories} csrfToken={csrfToken} run={run} hint={monthHint} />}
    {tab === 'categories' && <CategoriesTab categories={categories} csrfToken={csrfToken} run={run} />}
  </div>
}
