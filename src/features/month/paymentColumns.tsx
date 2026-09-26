import { Check } from 'lucide-react'
import { Badge, Button, Checkbox, RowMenu, Stepper, type Column, type MenuItem } from '@/components/ui'
import { amountToCheck, type Payment } from '@/lib/domain'
import { amount as plainAmount } from '@/lib/format'
import { countWeekdaysInPeriod, type Period } from '@/lib/period'
import { weekdayLabel } from '@/lib/schedule'
import Amount from './Amount'
import Attention from './Attention'
import { beforeBalances, dayText, isDate, round, total } from './utils'

type Options = {
  period: Period; readOnly: boolean; accountTag: (id: string) => React.ReactNode; accountName: (id: string) => string
  onChange: (id: string, patch: Partial<Payment>) => void; onRemove: (id: string) => void; onReset: (id: string) => void
}

const weeklyOf = (payment: Payment) => payment.unitPrice != null && payment.quantity != null
const whenOf = (payment: Payment) => weeklyOf(payment) && payment.weekdays ? weekdayLabel(payment.weekdays) : dayText(payment.due)
// Payments skipped this month stay in place, struck through, and are left out of the totals.
export const paymentRowClass = (payment: Payment) => payment.enabled ? undefined : 'is-muted'

export function paymentColumns({ period, readOnly, accountTag, accountName, onChange, onRemove, onReset }: Options): Column<Payment>[] {
  // Nothing is locked: changing an amount takes the tick off the row, so "Проверено N из M" stays true.
  const locked = (payment: Payment) => readOnly || !payment.enabled
  const past = (payment: Payment) => payment.enabled && !weeklyOf(payment) && beforeBalances(period, payment.due)
  return [
    { key: 'name', header: 'Платёж', sort: (payment) => payment.name, mobile: 'title', cell: (payment) => <span className="cell-name">
      <span className="cell-text">{payment.name}</span>
      {!payment.recurringPaymentId && <Badge>Разовый</Badge>}
      {payment.enabled && <Attention notes={[
        ...(amountToCheck(payment) && !payment.checked ? [{ label: 'Уточнить сумму', reason: 'Укажите точную сумму и подтвердите платёж' }] : []),
        ...(past(payment) ? [{ label: 'Уже оплачен?', reason: 'Дата раньше даты расчёта. Платёж может быть уже списан' }] : []),
      ]} />}
    </span> },
    { key: 'account', header: 'Счёт', sort: (payment) => accountName(payment.accountId), filter: { type: 'list', value: (payment) => payment.accountId, label: accountName }, cell: (payment) => accountTag(payment.accountId) },
    { key: 'when', header: 'Когда', sort: (payment) => isDate(payment.due) ? payment.due : `9${payment.due}`, cell: (payment) => <span className="muted">{whenOf(payment)}</span> },
    { key: 'amount', header: 'Сумма', align: 'right', mobile: 'amount', sort: (payment) => payment.amount,
      footer: (rows) => plainAmount(total(rows.filter((payment) => payment.enabled))),
      card: (payment) => <strong className="amount">{plainAmount(payment.amount)}</strong>,
      cell: (payment) => {
        if (!weeklyOf(payment)) return <Amount label={`Сумма: ${payment.name}`} value={payment.amount} readOnly={locked(payment)} plain
          onChange={(value) => onChange(payment.id, { amount: value, amountPending: false, checked: false })} />
        const setQuantity = (quantity: number) => onChange(payment.id, { quantity, amount: round(payment.unitPrice! * quantity), checked: false })
        return <div className="units units-cell">
          {locked(payment) ? <span>{payment.quantity} раз</span> : <Stepper label={`Сколько раз: ${payment.name}`} value={payment.quantity!} onChange={setQuantity} />}
          <span className="units-price">× {plainAmount(payment.unitPrice!)}</span>
          <strong className="amount">{plainAmount(payment.amount)}</strong>
        </div>
      } },
    { key: 'check', header: 'Проверено', mobile: 'end', className: 'actions',
      filter: { type: 'list', value: (payment) => !payment.enabled ? 'Не платим' : payment.checked ? 'Проверено' : 'Не проверено' },
      cell: (payment) => {
        if (readOnly) return payment.checked && payment.enabled ? <Check size={16} className="checked-mark" aria-label="Проверено" /> : null
        if (!payment.enabled) return <Button size="sm" onClick={() => onChange(payment.id, { enabled: true })}>Вернуть</Button>
        const calendar = weeklyOf(payment) && payment.weekdays ? countWeekdaysInPeriod(period, payment.weekdays) : null
        const menu: MenuItem[] = [
          ...(calendar !== null && calendar !== payment.quantity
            ? [{ label: `Поставить по календарю: ${calendar}`, onSelect: () => onChange(payment.id, { quantity: calendar, amount: round(payment.unitPrice! * calendar), checked: false }) }]
            : []),
          { label: 'Не платить в этом месяце', onSelect: () => onChange(payment.id, { enabled: false }) },
          ...(payment.recurringPaymentId
            ? payment.checked ? [] : [{ label: 'Вернуть как в настройках', onSelect: () => onReset(payment.id) }]
            : [{ label: 'Удалить', danger: true, onSelect: () => onRemove(payment.id) }]),
        ]
        return <div className="cell-actions">
          <Checkbox checked={Boolean(payment.checked)} label={`Проверено: ${payment.name}`} onChange={(checked) => onChange(payment.id, checked ? { checked, amountPending: false } : { checked })} />
          <RowMenu label={`Действия: ${payment.name}`} items={menu} />
        </div>
      } },
  ]
}
