import { cx } from '@/lib/format'
import type { Option } from './option'

// `tabs`: switches what the page shows, so the active one is solid blue; a value picker in a row stays light.
export default function Segmented<T extends string>({ value, options, onChange, label, size, tabs }: { value: T; options: readonly Option<T>[]; onChange: (value: T) => void; label: string; size?: 'sm'; tabs?: boolean }) {
  return <div className={cx('segmented', size === 'sm' && 'segmented-sm', tabs && 'segmented-tabs')} role="radiogroup" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'is-active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
}
