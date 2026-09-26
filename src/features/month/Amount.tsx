import { MoneyInput } from '@/components/ui'
import { amount, cx, money } from '@/lib/format'

// Editable amount in an open month, plain text in a closed one. `plain` drops the currency code: inside a table the
// column header and the total already say PLN, and thirty repetitions of it are thirty things to read past.
// `locked` means the row is ticked rather than the month closed, so the text says how to get the input back.
const lockHint = 'Строка проверена. Снимите «Проверено», чтобы изменить.'
export default function Amount({ value, readOnly, onChange, label, className, plain, locked }: { value: number; readOnly: boolean; onChange: (value: number) => void; label: string; className?: string; plain?: boolean; locked?: boolean }) {
  return readOnly
    ? <strong className={cx('amount', locked && 'is-locked', className)} title={locked ? lockHint : undefined}>{plain ? amount(value) : money(value)}</strong>
    : <MoneyInput label={label} value={value} onChange={onChange} />
}
