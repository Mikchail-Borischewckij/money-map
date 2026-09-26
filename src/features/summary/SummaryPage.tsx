"use client"

import { useEffect, useMemo, useState } from 'react'
import { Badge, Empty, Select } from '@/components/ui'
import { cx, periodTitle } from '@/lib/format'
import { summarize, type Amounts, type SummaryMonth } from '@/lib/summary'

const whole = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const pln = (grosz: number) => whole.format(Math.round(grosz / 100))
const usd = (cents: number | null) => cents === null ? '—' : whole.format(Math.round(cents / 100))
const rateText = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const dateText = (date: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

type Row = { key: string; label: string; total: Amounts; kind: 'total' | 'category' | 'result' }

export default function SummaryPage() {
  const [periods, setPeriods] = useState<SummaryMonth[] | null>(null)
  const [error, setError] = useState('')
  const [periodId, setPeriodId] = useState('')

  useEffect(() => {
    fetch('/api/summary', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject(new Error()))
      .then((rows: SummaryMonth[]) => setPeriods(rows))
      .catch(() => setError('Не удалось загрузить сводку.'))
  }, [])

  const newest = useMemo(() => [...(periods ?? [])].reverse(), [periods])
  const current = newest.find((period) => period.open) ?? newest[0]
  const selected = newest.find((period) => period.id === periodId) ?? current
  const summary = summarize(selected ? [selected] : [])
  const rows: Row[] = [
    { key: 'income', label: 'Доходы', total: summary.income, kind: 'total' },
    ...summary.incomeGroups.map((group) => ({ key: `income:${group.name}`, label: group.name, total: group.total, kind: 'category' as const })),
    { key: 'expenses', label: 'Расходы', total: summary.expenses, kind: 'total' },
    ...summary.expenseGroups.map((group) => ({ key: `expense:${group.name}`, label: group.name, total: group.total, kind: 'category' as const })),
    { key: 'result', label: 'Остаток', total: summary.result, kind: 'result' },
  ]

  const rateNote = selected?.rate === null
    ? 'Курс NBP пока недоступен, поэтому суммы в долларах не посчитаны. Курс подтянется при следующем открытии.'
    : selected?.rate && selected.rateDate
      ? `Курс NBP на ${dateText(selected.rateDate)}: ${rateText.format(selected.rate)} PLN за $.${selected.open ? ' Пока период открыт, курс берётся сегодняшний.' : ''}`
      : ''

  return <div className="page">
    <header className="page-head"><h1>Сводка</h1>
      {periods && periods.length > 0 && <div className="summary-controls">
        <span>Период</span>
        <Select compact label="Период" value={selected?.id ?? ''} onChange={setPeriodId}
          options={newest.map((period) => ({ value: period.id, label: periodTitle(period.month, period.startDay) }))} />
      </div>}
    </header>
    {error && <p className="toast toast-error" role="alert">{error}</p>}
    {periods === null && !error && <section className="card"><Empty>Загрузка…</Empty></section>}
    {periods?.length === 0 && <section className="card"><Empty>Периодов пока нет.</Empty></section>}
    {selected && <section className="card">
      <header className="card-head"><div className="page-title">
        <h2>{periodTitle(selected.month, selected.startDay)}</h2>
        {selected.open && <Badge tone="blue">План</Badge>}
      </div></header>
      <div className="table-scroll">
        <table className="money-table summary-table">
          <thead><tr><th scope="col">Показатель</th><th scope="col">PLN</th><th scope="col">$</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.key} className={cx(`is-${row.kind}`, row.kind === 'result' && row.total.pln < 0 && 'negative')}>
              <th scope="row">{row.label}</th>
              <td>{pln(row.total.pln)}</td>
              <td>{usd(row.total.usd)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {rateNote && <p className="note">{rateNote}</p>}
    </section>}
  </div>
}
