"use client"

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge, DataTable, Empty, Segmented, Select, type Column } from '@/components/ui'
import { cx, periodTitle } from '@/lib/format'
import { perMonth, summarize, type Amounts, type SummaryGroup, type SummaryMonth } from '@/lib/summary'

type Range = 'month' | 'year' | 'all'
const ranges = [{ value: 'month' as const, label: 'Месяц' }, { value: 'year' as const, label: 'Год' }, { value: 'all' as const, label: 'Всё время' }]

// Whole amounts: the column header already says PLN or $.
const whole = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const pln = (grosz: number) => whole.format(Math.round(grosz / 100))
const usd = (cents: number | null) => cents === null ? '—' : whole.format(Math.round(cents / 100))
const rateText = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const dateText = (date: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

type Row = { key: string; label: string; total: Amounts; depth: number; kind?: 'total' | 'result'; children?: Row[] }

const groupRows = (groups: SummaryGroup[], prefix: string, depth: number): Row[] => groups.map((group) => ({
  key: `${prefix}:${group.name}`, label: group.name, total: group.total, depth,
  children: group.items.map((item) => ({ key: `${prefix}:${group.name}:${item.name}`, label: item.name, total: item.total, depth: depth + 1 })),
}))

export default function SummaryPage() {
  const [months, setMonths] = useState<SummaryMonth[] | null>(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState<Range>('month')
  const [monthId, setMonthId] = useState('')
  const [year, setYear] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/summary', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject(new Error()))
      .then((rows: SummaryMonth[]) => setMonths(rows))
      .catch(() => setError('Не удалось загрузить сводку.'))
  }, [])

  // Newest first; the open month (or the last one) is where the page starts.
  const newest = useMemo(() => [...(months ?? [])].reverse(), [months])
  const current = newest.find((month) => month.open) ?? newest[0]
  const years = [...new Set(newest.map((month) => month.month.slice(0, 4)))]
  const pickedMonth = monthId || current?.id || ''
  const pickedYear = year || current?.month.slice(0, 4) || ''
  const selected = newest.filter((month) => range === 'all' || (range === 'year' ? month.month.startsWith(pickedYear) : month.id === pickedMonth))
  const summary = summarize(selected)
  const several = selected.length > 1

  const toggle = (key: string) => setOpen((keys) => { const next = new Set(keys); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const rows: Row[] = [
    ...groupRows(summary.incomeGroups, 'in', 0),
    { key: 'income', label: 'Все доходы', total: summary.income, depth: 0, kind: 'total' },
    { key: 'expenses', label: 'Итого расходов', total: summary.expenses, depth: 0, kind: 'total', children: groupRows(summary.expenseGroups, 'out', 1) },
    { key: 'result', label: 'Итого', total: summary.result, depth: 0, kind: 'result' },
    ...(summary.savings.pln > 0 ? [
      { key: 'savings', label: 'Отложить', total: summary.savings, depth: 0 },
      { key: 'free', label: 'Свободно', total: summary.free, depth: 0, kind: 'total' as const },
    ] : []),
  ]
  const visible = (list: Row[]): Row[] => list.flatMap((row) => [row, ...(row.children && open.has(row.key) ? visible(row.children) : [])])

  const missingRate = selected.some((month) => month.rate === null)
  const single = selected.length === 1 ? selected[0] : null
  const rateNote = missingRate
    ? 'Для части месяцев ещё нет курса NBP, поэтому доллары не посчитаны. Курс подтянется при следующем открытии.'
    : single?.rate && single.rateDate
      ? `Курс NBP на ${dateText(single.rateDate)}: ${rateText.format(single.rate)} PLN за $.${single.open ? ' Пока месяц открыт, курс берётся сегодняшний.' : ''}`
      : 'Каждый месяц пересчитан в доллары по своему курсу NBP.'

  const monthColumn = (label: string, value: (month: SummaryMonth) => Amounts, key: string, negative = false): Column<SummaryMonth> => ({
    key, header: label, align: 'right', mobile: key === 'result' ? 'amount' : 'meta', mobileLabel: key !== 'result', sort: (month) => value(month).pln,
    cell: (month) => { const amount = value(month); return <span className={cx('summary-cell', negative && amount.pln < 0 && 'negative')}>{pln(amount.pln)} PLN<span className="summary-usd">$ {usd(amount.usd)}</span></span> },
  })
  const monthColumns: Column<SummaryMonth>[] = [
    { key: 'month', header: 'Период', mobile: 'title', sort: (month) => month.month, cell: (month) => <span className="cell-name"><span className="cell-text">{periodTitle(month.month, month.startDay)}</span>{month.open && <Badge tone="blue">план</Badge>}</span> },
    monthColumn('Доходы', (month) => summarize([month]).income, 'income'),
    monthColumn('Расходы', (month) => summarize([month]).expenses, 'expenses'),
    monthColumn('Итого', (month) => summarize([month]).result, 'result', true),
  ]

  return <div className="page">
    <header className="page-head"><h1>Сводка</h1>
      {months && months.length > 0 && <div className="summary-controls">
        <Segmented tabs size="sm" label="Период" value={range} options={ranges} onChange={setRange} />
        {range === 'month' && <Select compact label="Месяц" value={pickedMonth} onChange={setMonthId}
          options={newest.map((month) => ({ value: month.id, label: periodTitle(month.month, month.startDay) }))} />}
        {range === 'year' && <Select compact label="Год" value={pickedYear} onChange={setYear} options={years.map((value) => ({ value, label: value }))} />}
      </div>}
    </header>
    {error && <p className="toast toast-error" role="alert">{error}</p>}
    {months === null && !error && <section className="card"><Empty>Загрузка…</Empty></section>}
    {months?.length === 0 && <section className="card"><Empty>Месяцев пока нет.</Empty></section>}
    {months && months.length > 0 && <>
      <section className="card">
        <header className="card-head"><div className="page-title">
          <h2>{range === 'all' ? 'Всё время' : range === 'year' ? `${pickedYear} год` : single ? periodTitle(single.month, single.startDay) : ''}</h2>
          {selected.some((month) => month.open) && <Badge tone="blue">{several ? 'с открытым месяцем' : 'план'}</Badge>}
        </div></header>
        <div className="table-scroll">
          <table className="money-table summary-table">
            <thead><tr><th>Тип</th><th>PLN</th><th>$</th>{several && <th className="summary-avg">В среднем за месяц<small>PLN</small></th>}</tr></thead>
            <tbody>
              {visible(rows).map((row) => {
                const expandable = Boolean(row.children?.length)
                const expanded = open.has(row.key)
                const negative = row.kind === 'result' || row.key === 'free' ? row.total.pln < 0 : false
                return <tr key={row.key} className={cx(row.kind && `is-${row.kind}`, row.depth > 0 && 'is-nested', negative && 'negative')}>
                  <th style={{ paddingLeft: row.depth * 22 }}>
                    {expandable
                      ? <button type="button" className="summary-toggle" aria-expanded={expanded} onClick={() => toggle(row.key)}><ChevronRight size={16} className={cx('chevron', expanded && 'is-open')} />{row.label}</button>
                      : <span>{row.label}</span>}
                  </th>
                  <td>{pln(row.total.pln)}</td>
                  <td>{usd(row.total.usd)}</td>
                  {several && <td className="summary-avg">{pln(perMonth(row.total, summary.months).pln)}</td>}
                </tr>
              })}
            </tbody>
          </table>
        </div>
        <p className="note">{rateNote}</p>
      </section>
      {several && <section className="card">
        <header className="card-head"><div><h2>По месяцам</h2></div></header>
        <DataTable label="По месяцам" rows={selected} rowKey={(month) => month.id} columns={monthColumns} defaultSort={{ key: 'month', dir: 'desc' }} />
      </section>}
    </>}
  </div>
}
