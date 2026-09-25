import { cx } from '@/lib/format'
import type { Option } from './option'

export default function Segmented<T extends string>({ value, options, onChange, label, size }: { value: T; options: readonly Option<T>[]; onChange: (value: T) => void; label: string; size?: 'sm' }) {
  return <div className={cx('segmented', size === 'sm' && 'segmented-sm')} role="radiogroup" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'is-active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
}
