import { cx } from '@/lib/format'

export default function AccountBadge({ name, hue }: { name: string; hue: number | null }) {
  return <span className={cx('account-badge', hue === null && 'is-plain')} style={hue === null ? undefined : { '--hue': hue } as React.CSSProperties}>{name}</span>
}
