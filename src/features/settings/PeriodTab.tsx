"use client"

import { Select } from '@/components/ui'
import { maxStartDay } from '@/lib/period'
import { send } from './api'
import type { Run } from './types'

const options = Array.from({ length: maxStartDay }, (_, index) => ({ value: String(index + 1), label: index === 0 ? '1-го (календарный месяц)' : `${index + 1}-го` }))

// The day each planning period starts on. The open month moves to the new dates at once; closed ones keep theirs.
export default function PeriodTab({ startDay, csrfToken, run }: { startDay: number; csrfToken: string; run: Run }) {
  const change = (value: string) => {
    const periodStartDay = Number(value)
    if (periodStartDay === startDay) return
    void run(() => send('/api/settings', 'PUT', csrfToken, { periodStartDay }), 'Сохранено. Открытый месяц получил новые даты.', (lists) => ({ ...lists, periodStartDay }))
  }
  return <section className="card">
    <header className="card-head"><div><h2>Период</h2><p className="muted">С какого числа начинается месяц планирования. Закрытые месяцы не меняются.</p></div></header>
    <div className="period-field"><Select label="Месяц начинается" value={String(startDay)} options={options} onChange={change} /></div>
  </section>
}
