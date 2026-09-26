"use client"

import { useState } from 'react'
import { Badge, Button, Dialog } from '@/components/ui'
import type { MonthPlanState } from '@/hooks/useMonthPlan'
import type { CategoryNames } from '@/lib/domain'
import { money, monthName, periodTitle } from '@/lib/format'
import BalancesDate from './BalancesDate'
import MonthView from './MonthView'
import { incomeToCheck, paymentToCheck, savingsOf } from './utils'

export default function MonthPage({ month, categories, onOpenSettings }: { month: MonthPlanState; categories: CategoryNames; onOpenSettings: () => void }) {
  const [confirmClose, setConfirmClose] = useState(false)
  const { plan, summary, open, nextMonth } = month
  const liveAccounts = plan.accounts.filter((account) => !account.isArchived)
  const unchecked = liveAccounts.filter((account) => !account.balanceConfirmed).length
  const incomesToCheck = plan.incomes.filter(incomeToCheck).length
  const paymentsToCheck = plan.payments.filter(paymentToCheck).length
  const transfersToMake = summary.transfers.filter((transfer) => !transfer.done).length
  const transfersStep = Boolean(savingsOf(plan)) && liveAccounts.length > 0 ? 5 : 4
  // Every balance, income and payment must be checked and every transfer made before the month can be closed.
  // All of it at once, each line a link to its step: fixing one used to only reveal the next.
  const blockers: { text: string; step?: number }[] = [
    ...(liveAccounts.length === 0 ? [{ text: 'Добавьте счёт в настройках' }] : []),
    ...(unchecked > 0 ? [{ text: `Проверьте, сколько на счетах: осталось ${unchecked}`, step: 1 }] : []),
    ...(incomesToCheck > 0 ? [{ text: `Проверьте доходы: осталось ${incomesToCheck}`, step: 2 }] : []),
    ...(paymentsToCheck > 0 ? [{ text: `Проверьте платежи: осталось ${paymentsToCheck}`, step: 3 }] : []),
    ...(transfersToMake > 0 ? [{ text: `Отметьте переводы: осталось ${transfersToMake}`, step: transfersStep }] : []),
  ]
  const saving = month.dirty || month.saveState === 'saving'
  const failed = month.saveState === 'conflict' || month.saveState === 'error'
  const saveText = month.saveState === 'conflict' ? 'Конфликт' : month.saveState === 'error' ? 'Не сохранено' : saving ? 'Сохраняем…' : 'Сохранено'
  const actions = { onResetPayment: (id: string) => void month.reset('payments', id), onResetIncome: (id: string) => void month.reset('incomes', id), onOpenSettings }

  const footer = open
    ? (goToStep: (step: number) => void) => <div className="card close-card">
      {blockers.length > 0 && <ul className="close-todo">
        {blockers.map((blocker) => <li key={blocker.text}>
          {blocker.step ? <button type="button" className="link" onClick={() => goToStep(blocker.step!)}>{blocker.text}</button> : blocker.text}
        </li>)}
      </ul>}
      <Button variant="primary" className="btn-block" disabled={blockers.length > 0 || saving} onClick={() => setConfirmClose(true)}>Закрыть месяц</Button>
      {blockers.length === 0 && saving && <p className="muted">Сохраняем изменения…</p>}
    </div>
    : nextMonth ? () => <div className="card close-card">
      <p className="muted">Месяц можно открыть снова, пока следующий не начат.</p>
      <Button className="btn-block" onClick={() => void month.reopenMonth()}>Открыть снова</Button>
    </div> : undefined

  return <div className="page">
    {!open && nextMonth && <div className="card next-month">
      <div><h2>{monthName(plan.month, false)} закрыт</h2><p className="muted">Можно начинать следующий месяц.</p></div>
      <Button variant="primary" onClick={() => void month.startNext()}>Начать {monthName(nextMonth, false).toLowerCase()}</Button>
    </div>}
    <header className="page-head">
      <div className="page-title">
        <h1>{periodTitle(plan.month, plan.startDay)}</h1>
        <Badge tone={open ? 'blue' : 'neutral'}>{open ? 'Открыт' : 'Закрыт'}</Badge>
        {open && <span className={failed ? 'save-state is-failed' : 'save-state'} aria-live="polite">{saveText}</span>}
      </div>
      {liveAccounts.length > 0 && <BalancesDate plan={plan} readOnly={!open} update={month.update} />}
    </header>
    {open && liveAccounts.length === 0 ? <div className="card onboarding">
      <h2>Начните с настроек</h2>
      <ol><li>Добавьте счета.</li><li>Добавьте регулярные доходы и платежи.</li><li>Вернитесь в план месяца.</li></ol>
      <Button variant="primary" onClick={onOpenSettings}>Открыть настройки</Button>
    </div> : <MonthView plan={plan} summary={summary} readOnly={!open} categories={categories} actions={actions} update={month.update} footer={footer} />}
    {confirmClose && <Dialog title={`Закрыть ${monthName(plan.month, false).toLowerCase()}?`} onClose={() => setConfirmClose(false)}
      actions={<><Button onClick={() => setConfirmClose(false)}>Отмена</Button><Button variant="primary" onClick={() => { setConfirmClose(false); void month.closeMonth() }}>Закрыть месяц</Button></>}>
      <p>После закрытия месяц можно только смотреть. Изменения в настройках его не затронут.</p>
      <p className="muted">Итог: {summary.freeAfterPlan < 0 ? 'не хватает' : 'на жизнь остаётся'} {money(Math.abs(summary.freeAfterPlan))}.</p>
    </Dialog>}
  </div>
}
