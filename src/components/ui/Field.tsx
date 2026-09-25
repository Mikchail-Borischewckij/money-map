import { cx } from '@/lib/format'

export default function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={cx('field', wide && 'field-wide')}><span className="field-label">{label}</span>{children}</div>
}
