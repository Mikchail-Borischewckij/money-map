"use client"

import { useState } from 'react'
import { Badge, Button, Dialog } from '@/components/ui'
import type { MonthPlanState } from '@/hooks/useMonthPlan'
import { money, monthName, periodTitle } from '@/lib/format'
import { amountToCheck } from '@/lib/domain'
import BalancesDate from './BalancesDate'
import MonthView from './MonthView'

export default function MonthPage({ month, categories, onOpenSettings }: { month: MonthPlanState; categories: string[]; onOpenSettings: () => void }) {
  const [confirmClose, setConfirmClose] = useState(false)
  const { plan, summary, open, nextMonth } = month
  const liveAccounts = plan.accounts.filter((account) => !account.isArchived)
  const unchecked = liveAccounts.filter((account) => !account.balanceConfirmed).length
  const incomesToCheck = plan.incomes.filter(amountToCheck).length
  // Every payment still planned must be checked before the month can be closed.
  const paymentsToCheck = plan.payments.filter((payment) => payment.enabled && !payment.checked).length
  const closeBlocker = liveAccounts.length === 0 ? 'Добавьте счёт в настройках.'
    : unchecked > 0 ? `Проверьте остатки: осталось ${unchecked}.`
    : incomesToCheck > 0 ? `Уточните суммы доходов: осталось ${incomesToCheck}.`
    : paymentsToCheck > 0 ? `Проверьте платежи: осталось ${paymentsToCheck}.`
    : month.dirty || month.saveState === 'saving' ? 'Сохраняем изменения…' : ''
  const saveText = month.saveState === 'conflict' ? 'Конфликт' : month.saveState === 'error' ? 'Не сохранено' : month.saveState === 'saving' || month.dirty ? 'Сохраняем…' : 'Сохранено'
  const actions = { onResetPayment: (id: string) => void month.reset('payments', id), onResetIncome: (id: string) => void month.reset('incomes', id), onOpenSettings }

  const footer = open
    ? <div className="card close-card">
      <Button variant="primary" className="btn-block" disabled={Boolean(closeBlocker)} onClick={() => setConfirmClose(true)}>Закрыть месяц</Button>
      {closeBlocker && <p className="muted">{closeBlocker}</p>}
    </div>
    : nextMonth && <div className="card close-card">
      <p className="muted">Ошиблись? Месяц можно открыть снова, пока следующий не начат.</p>
      <Button className="btn-block" onClick={() => void month.reopenMonth()}>Открыть снова</Button>
    </div>

  return <div className="page">
    {!open && nextMonth && <div className="card next-month">
      <div><h2>{monthName(plan.month, false)} закрыт</h2><p className="muted">Можно начинать следующий месяц.</p></div>
      <Button variant="primary" onClick={() => void month.startNext()}>Начать {monthName(nextMonth, false).toLowerCase()}</Button>
    </div>}
    <header className="page-head">
      <div className="page-title">
        <h1>{periodTitle(plan.month, plan.startDay)}</h1>
        <Badge tone={open ? 'blue' : 'neutral'}>{open ? 'Открыт' : 'Закрыт'}</Badge>
        {open && <span className="save-state" aria-live="polite">{saveText}</span>}
      </div>
      {liveAccounts.length > 0 && <BalancesDate plan={plan} readOnly={!open} update={month.update} />}
    </header>
    {open && liveAccounts.length === 0 ? <div className="card onboarding">
      <h2>Начните с настроек</h2>
      <ol><li>Добавьте счета.</li><li>Добавьте регулярные доходы и платежи.</li><li>Вернитесь сюда — месяц соберётся из настроек.</li></ol>
      <Button variant="primary" onClick={onOpenSettings}>Открыть настройки</Button>
    </div> : <MonthView plan={plan} summary={summary} readOnly={!open} categories={categories} actions={actions} update={month.update} footer={footer} />}
    {confirmClose && <Dialog title={`Закрыть ${monthName(plan.month, false).toLowerCase()}?`} onClose={() => setConfirmClose(false)}
      actions={<><Button onClick={() => setConfirmClose(false)}>Отмена</Button><Button variant="primary" onClick={() => { setConfirmClose(false); void month.closeMonth() }}>Закрыть месяц</Button></>}>
      <p>После закрытия месяц можно только смотреть. Изменения в настройках его не затронут.</p>
      <p className="muted">Итог: {summary.freeAfterPlan < 0 ? 'не хватает' : 'на жизнь'} {money(Math.abs(summary.freeAfterPlan))}.</p>
    </Dialog>}
  </div>
}
