import { Check } from 'lucide-react'
import { cx } from '@/lib/format'

export default function Checkbox({ checked, onChange, children, disabled }: { checked: boolean; onChange: (checked: boolean) => void; children?: React.ReactNode; disabled?: boolean }) {
  return <label className={cx('checkbox', disabled && 'is-disabled')}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span className="checkbox-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
    {children && <span className="checkbox-label">{children}</span>}
  </label>
}
