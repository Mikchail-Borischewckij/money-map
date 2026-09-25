import { Minus, Plus } from 'lucide-react'

export default function Stepper({ value, onChange, label, min = 0, max = 31 }: { value: number; onChange: (value: number) => void; label: string; min?: number; max?: number }) {
  return <div className="stepper" role="group" aria-label={label}>
    <button type="button" aria-label="Меньше" disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={14} /></button>
    <span aria-live="polite">{value}</span>
    <button type="button" aria-label="Больше" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={14} /></button>
  </div>
}
