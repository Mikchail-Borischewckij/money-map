import { cx } from '@/lib/format'

export default function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'blue' | 'warn' | 'danger' | 'ok' }) {
  return <span className={cx('badge', `badge-${tone}`)}>{children}</span>
}
