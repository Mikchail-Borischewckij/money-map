"use client"

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Badge, Empty } from '@/components/ui'
import MonthView from '@/features/month/MonthView'
import { toUiPlan, toUiSummary, type ServerRecord } from '@/lib/api-client'
import { cx, money, periodTitle } from '@/lib/format'

type HistoryItem = { id: string; year: number; month: number; startDay: number; status: string; totalPayments: number; totalSavings: number; freeAfterPlan: number }
const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
const noActions = { onResetPayment: () => undefined, onResetIncome: () => undefined, onOpenSettings: () => undefined }

// Closed months only; each opens read-only.
export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [viewing, setViewing] = useState<ServerRecord | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/plans', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject(new Error()))
      .then((rows: HistoryItem[]) => setItems(rows.filter((row) => row.status === 'Finalized')))
      .catch(() => setError('Не удалось загрузить историю.'))
  }, [])
  const open = async (id: string) => {
    const response = await fetch(`/api/plans/${id}`, { cache: 'no-store' })
    if (response.ok) setViewing(await response.json()); else setError('Не удалось открыть месяц.')
  }

  if (viewing) return <div className="page">
    <button type="button" className="link back" onClick={() => setViewing(null)}><ArrowLeft size={16} />История</button>
    <header className="page-head"><div className="page-title"><h1>{periodTitle(viewing.plan.month, viewing.plan.startDay)}</h1><Badge>Закрыт</Badge></div></header>
    <MonthView plan={toUiPlan(viewing.plan)} summary={toUiSummary(viewing.summary)} readOnly categories={{ payment: [], income: [] }} actions={noActions} update={() => undefined} />
  </div>

  return <div className="page">
    <header className="page-head"><h1>История</h1></header>
    {error && <p className="toast toast-error" role="alert">{error}</p>}
    <section className="card">
      {items === null && !error && <Empty>Загрузка…</Empty>}
      {items?.length === 0 && <Empty>Закрытых месяцев пока нет.</Empty>}
      <div className="rows">
        {items?.map((item) => <button type="button" className="row row-button" key={item.id} onClick={() => void open(item.id)}>
          <div className="row-main"><strong>{periodTitle(monthKey(item.year, item.month), item.startDay)}</strong><span className="row-meta">Платежи {money(item.totalPayments / 100)} · отложено {money(item.totalSavings / 100)}</span></div>
          <div className="row-side"><span className={cx('amount', item.freeAfterPlan < 0 && 'negative')}>{item.freeAfterPlan < 0 ? 'Не хватило ' : 'На жизнь '}{money(Math.abs(item.freeAfterPlan) / 100)}</span></div>
        </button>)}
      </div>
    </section>
  </div>
}
