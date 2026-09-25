import { Check } from 'lucide-react'
import { Badge, Button, Checkbox, RowMenu, Stepper, TextInput, type MenuItem } from '@/components/ui'
import { amountToCheck, type Payment } from '@/lib/domain'
import { money } from '@/lib/format'
import { countWeekdaysInPeriod, type Period } from '@/lib/period'
import { weekdayLabel } from '@/lib/schedule'
import Amount from './Amount'
import { beforeBalances, dayText, round } from './utils'

export default function PaymentRow({ payment, period, readOnly, accountTag, onChange, onRemove, onReset }: {
  payment: Payment; period: Period; readOnly: boolean; accountTag: (id: string) => React.ReactNode
  onChange: (patch: Partial<Payment>) => void; onRemove: () => void; onReset: () => void
}) {
  const weekly = payment.unitPrice != null && payment.quantity != null
  const when = weekly && payment.weekdays ? weekdayLabel(payment.weekdays) : dayText(payment.due)
  const details = [when, payment.category].filter(Boolean).join(' · ')
  // On a phone the account and date columns are hidden and shown under the name instead.
  const sub = <div className="cell-sub">{accountTag(payment.accountId)}{details && <span>{details}</span>}</div>

  if (!payment.enabled) return <tr className="is-muted">
    <td><span className="cell-name">{payment.name}</span>{sub}
      {readOnly ? payment.exclusionReason && <div className="row-meta">{payment.exclusionReason}</div>
        : <TextInput label={`Причина: ${payment.name}`} placeholder="Причина (необязательно)" value={payment.exclusionReason ?? ''} onChange={(exclusionReason) => onChange({ exclusionReason })} />}
    </td>
    <td className="col-opt">{accountTag(payment.accountId)}</td>
    <td className="col-opt muted">{details}</td>
    <td className="num">{money(payment.amount)}</td>
    <td className="col-check" />
    <td className="actions">{!readOnly && <Button size="sm" onClick={() => onChange({ enabled: true, exclusionReason: '' })}>Вернуть</Button>}</td>
  </tr>

  // A checked amount is locked; uncheck it to change the amount.
  const locked = readOnly || Boolean(payment.checked)
  const menu: MenuItem[] = readOnly ? [] : payment.recurringPaymentId
    ? [{ label: 'Не платить в этом месяце', onSelect: () => onChange({ enabled: false }) }, ...(payment.checked ? [] : [{ label: 'Как в настройках', onSelect: onReset }])]
    : [{ label: 'Удалить', danger: true, onSelect: onRemove }]
  const calendar = weekly && payment.weekdays ? countWeekdaysInPeriod(period, payment.weekdays) : null
  const setQuantity = (quantity: number) => onChange({ quantity, amount: round(payment.unitPrice! * quantity) })
  const toCheck = amountToCheck(payment) && !payment.checked
  const past = !weekly && beforeBalances(period, payment.due)
  return <tr>
    <td>
      <span className="cell-name">{payment.name}{!payment.recurringPaymentId && <Badge>разовый</Badge>}{toCheck && <Badge tone="warn">уточните сумму</Badge>}{past && <Badge tone="warn">дата прошла</Badge>}</span>
      {sub}
    </td>
    <td className="col-opt">{accountTag(payment.accountId)}</td>
    <td className="col-opt muted">{details}</td>
    <td className="num">
      {weekly ? <div className="units units-cell">
        {locked ? <span>{payment.quantity} раз</span> : <Stepper label={`Сколько раз: ${payment.name}`} value={payment.quantity!} onChange={setQuantity} />}
        <span className="units-price">× {money(payment.unitPrice!)}</span>
        {!locked && calendar !== null && calendar !== payment.quantity && <button type="button" className="link" onClick={() => setQuantity(calendar)}>по календарю {calendar}</button>}
        <strong className="amount">{money(payment.amount)}</strong>
      </div> : <Amount label={`Сумма: ${payment.name}`} value={payment.amount} readOnly={locked} onChange={(amount) => onChange({ amount, amountPending: false })} />}
    </td>
    <td className="col-check">{readOnly
      ? payment.checked && <Check size={16} className="checked-mark" aria-label="Проверено" />
      : <Checkbox checked={Boolean(payment.checked)} label={`Проверено: ${payment.name}`} onChange={(checked) => onChange(checked ? { checked, amountPending: false } : { checked })} />}</td>
    <td className="actions"><div className="cell-actions">
      {!readOnly && toCheck && <Button size="sm" variant="ghost" onClick={() => onChange({ amountPending: false })}>Сумма верна</Button>}
      {!readOnly && past && <Button size="sm" variant="ghost" onClick={() => onChange({ enabled: false, exclusionReason: 'Оплачен до даты остатков' })}>Уже оплачен</Button>}
      <RowMenu label={`Действия: ${payment.name}`} items={menu} />
    </div></td>
  </tr>
}
