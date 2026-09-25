import { Badge, Button, RowMenu, Stepper, TextInput, type MenuItem } from '@/components/ui'
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
  const meta = <>{accountTag(payment.accountId)}{details && <span>{details}</span>}</>

  if (!payment.enabled) return <div className="row is-muted">
    <div className="row-main"><strong>{payment.name}</strong>
      {readOnly ? payment.exclusionReason && <span className="row-meta">{payment.exclusionReason}</span>
        : <TextInput label={`Причина: ${payment.name}`} placeholder="Причина (необязательно)" value={payment.exclusionReason ?? ''} onChange={(exclusionReason) => onChange({ exclusionReason })} />}
    </div>
    <div className="row-side"><span className="amount">{money(payment.amount)}</span>{!readOnly && <Button size="sm" onClick={() => onChange({ enabled: true, exclusionReason: '' })}>Вернуть</Button>}</div>
  </div>

  const menu: MenuItem[] = readOnly ? [] : payment.recurringPaymentId
    ? [{ label: 'Не платить в этом месяце', onSelect: () => onChange({ enabled: false }) }, { label: 'Как в настройках', onSelect: onReset }]
    : [{ label: 'Удалить', danger: true, onSelect: onRemove }]
  const calendar = weekly && payment.weekdays ? countWeekdaysInPeriod(period, payment.weekdays) : null
  const setQuantity = (quantity: number) => onChange({ quantity, amount: round(payment.unitPrice! * quantity) })
  const toCheck = amountToCheck(payment)
  const past = !weekly && beforeBalances(period, payment.due)
  return <div className="row">
    <div className="row-main"><strong>{payment.name}{!payment.recurringPaymentId && <Badge>разовый</Badge>}{toCheck && <Badge tone="warn">уточните сумму</Badge>}{past && <Badge tone="warn">дата прошла</Badge>}</strong><span className="row-meta row-tags">{meta}</span></div>
    <div className="row-side row-side-wrap">
      {weekly ? <>
        <div className="units">
          {readOnly ? <span>{payment.quantity} раз</span> : <Stepper label={`Сколько раз: ${payment.name}`} value={payment.quantity!} onChange={setQuantity} />}
          <span className="units-price">× {money(payment.unitPrice!)}</span>
          {!readOnly && calendar !== null && calendar !== payment.quantity && <button type="button" className="link" onClick={() => setQuantity(calendar)}>по календарю {calendar}</button>}
        </div>
        <strong className="amount">{money(payment.amount)}</strong>
      </> : <Amount label={`Сумма: ${payment.name}`} value={payment.amount} readOnly={readOnly} onChange={(amount) => onChange({ amount, amountPending: false })} />}
      {!readOnly && toCheck && <Button size="sm" variant="ghost" onClick={() => onChange({ amountPending: false })}>Сумма верна</Button>}
      {!readOnly && past && <Button size="sm" variant="ghost" onClick={() => onChange({ enabled: false, exclusionReason: 'Оплачен до даты остатков' })}>Уже оплачен</Button>}
      <RowMenu label={`Действия: ${payment.name}`} items={menu} />
    </div>
  </div>
}
