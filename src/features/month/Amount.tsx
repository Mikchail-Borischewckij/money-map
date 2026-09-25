import { MoneyInput } from '@/components/ui'
import { money } from '@/lib/format'

// Editable amount in an open month, plain text in a closed one.
export default function Amount({ value, readOnly, onChange, label }: { value: number; readOnly: boolean; onChange: (value: number) => void; label: string }) {
  return readOnly ? <strong className="amount">{money(value)}</strong> : <MoneyInput label={label} value={value} onChange={onChange} />
}
