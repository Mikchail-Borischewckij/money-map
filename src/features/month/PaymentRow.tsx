import { Badge, Button, RowMenu, Stepper, TextInput, type MenuItem } from '@/components/ui'
import type { Payment } from '@/lib/domain'
import { money } from '@/lib/format'
import { countWeekdays, weekdayLabel } from '@/lib/schedule'
import Amount from './Amount'
import { dayText, round } from './utils'

export default function PaymentRow({ payment, month, readOnly, accountName, onChange, onRemove, onReset }: {
  payment: Payment; month: string; readOnly: boolean; accountName: (id: string) => string
  onChange: (patch: Partial<Payment>) => void; onRemove: () => void; onReset: () => void
}) {
  const weekly = payment.unitPrice != null && payment.quantity != null
  const when = weekly && payment.weekdays ? weekdayLabel(payment.weekdays) : dayText(payment.due)
  const meta = [when, accountName(payment.accountId), payment.category].filter(Boolean).join(' · ')

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
  const calendar = weekly && payment.weekdays ? countWeekdays(month, payment.weekdays) : null
  const setQuantity = (quantity: number) => onChange({ quantity, amount: round(payment.unitPrice! * quantity) })
  return <div className="row">
    <div className="row-main"><strong>{payment.name}{!payment.recurringPaymentId && <Badge>разовый</Badge>}</strong><span className="row-meta">{meta}</span></div>
    <div className="row-side row-side-wrap">
      {weekly ? <>
        <div className="units">
          {readOnly ? <span>{payment.quantity} раз</span> : <Stepper label={`Сколько раз: ${payment.name}`} value={payment.quantity!} onChange={setQuantity} />}
          <span className="units-price">× {money(payment.unitPrice!)}</span>
          {!readOnly && calendar !== null && calendar !== payment.quantity && <button type="button" className="link" onClick={() => setQuantity(calendar)}>по календарю {calendar}</button>}
        </div>
        <strong className="amount">{money(payment.amount)}</strong>
      </> : <Amount label={`Сумма: ${payment.name}`} value={payment.amount} readOnly={readOnly} onChange={(amount) => onChange({ amount })} />}
      <RowMenu label={`Действия: ${payment.name}`} items={menu} />
    </div>
  </div>
}
