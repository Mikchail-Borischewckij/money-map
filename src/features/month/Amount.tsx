import { MoneyInput } from '@/components/ui'
import { amount, cx, money } from '@/lib/format'

// Editable amount in an open month, plain text in a closed one. `plain` drops the currency code: inside a table the
// column header and the total already say PLN, and thirty repetitions of it are thirty things to read past.
export default function Amount({ value, readOnly, onChange, label, className, plain }: { value: number; readOnly: boolean; onChange: (value: number) => void; label: string; className?: string; plain?: boolean }) {
  return readOnly ? <strong className={cx('amount', className)}>{plain ? amount(value) : money(value)}</strong> : <MoneyInput label={label} value={value} onChange={onChange} />
}
