import { cx } from '@/lib/format'

export default function Badge({ children, tone = 'neutral', title }: { children: React.ReactNode; tone?: 'neutral' | 'blue' | 'warn' | 'danger' | 'ok'; title?: string }) {
  return <span className={cx('badge', `badge-${tone}`)} title={title}>{children}</span>
}
