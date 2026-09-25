import { MoneyInput } from '@/components/ui'
import { cx, money } from '@/lib/format'

// Editable amount in an open month, plain text in a closed one (or wherever editing is locked).
export default function Amount({ value, readOnly, onChange, label, className }: { value: number; readOnly: boolean; onChange: (value: number) => void; label: string; className?: string }) {
  return readOnly ? <strong className={cx('amount', className)}>{money(value)}</strong> : <MoneyInput label={label} value={value} onChange={onChange} />
}
