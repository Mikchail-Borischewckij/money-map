"use client"

import { useCallback, useEffect, useState } from 'react'
import { Segmented, type Option } from '@/components/ui'
import AccountsTab from './AccountsTab'
import CategoriesTab from './CategoriesTab'
import PeriodTab from './PeriodTab'
import TemplatesTab from './TemplatesTab'
import type { Lists, Preview } from './types'

type Tab = 'accounts' | 'payments' | 'incomes' | 'categories' | 'period'
const tabs: Option<Tab>[] = [{ value: 'accounts', label: 'Счета' }, { value: 'payments', label: 'Платежи' }, { value: 'incomes', label: 'Доходы' }, { value: 'categories', label: 'Категории' }, { value: 'period', label: 'Период' }]
const empty: Lists = { accounts: [], payments: [], incomes: [], categories: [], periodStartDay: 1 }

export default function SettingsPage({ csrfToken, onChanged }: { csrfToken: string; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>('accounts')
  const [lists, setLists] = useState<Lists>(empty)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const responses = await Promise.all(['/api/accounts', '/api/recurring-payments', '/api/recurring-incomes', '/api/categories', '/api/settings'].map((url) => fetch(url, { cache: 'no-store' })))
    if (responses.some((response) => !response.ok)) throw new Error('Не удалось загрузить настройки.')
    const [accounts, payments, incomes, categories, settings] = await Promise.all(responses.map((response) => response.json()))
    setLists({ accounts, payments, incomes, categories, periodStartDay: settings.periodStartDay })
  }, [])
  useEffect(() => { refresh().catch((failure: Error) => setError(failure.message)) }, [refresh])

  // The change shows at once (preview); the server call runs behind it, then the lists and the open month are reloaded
  // in the background. On failure the reload puts back what the server has.
  const run = async (action: () => Promise<unknown>, done: string, preview?: Preview) => {
    setError(''); setMessage('')
    if (preview) setLists(preview)
    try {
      const result = await action() as { monthNote?: string } | null
      setMessage([done, result?.monthNote].filter(Boolean).join(' '))
      onChanged()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Ошибка') }
    refresh().catch((failure: Error) => setError(failure.message))
  }

  return <div className="page">
    <header className="page-head"><h1>Настройки</h1></header>
    <Segmented tabs label="Раздел настроек" value={tab} options={tabs} onChange={(value) => { setTab(value); setMessage(''); setError('') }} />
    {message && <p className="toast" role="status">{message}</p>}
    {error && <p className="toast toast-error" role="alert">{error}</p>}
    {tab === 'accounts' && <AccountsTab accounts={lists.accounts} csrfToken={csrfToken} run={run} />}
    {tab === 'payments' && <TemplatesTab kind="payment" items={lists.payments} accounts={lists.accounts} categories={lists.categories} csrfToken={csrfToken} run={run} />}
    {tab === 'incomes' && <TemplatesTab kind="income" items={lists.incomes} accounts={lists.accounts} categories={lists.categories} csrfToken={csrfToken} run={run} />}
    {tab === 'period' && <PeriodTab startDay={lists.periodStartDay} csrfToken={csrfToken} run={run} />}
    {tab === 'categories' && <CategoriesTab categories={lists.categories} csrfToken={csrfToken} run={run} />}
  </div>
}
