import { inferBank, type BankId } from '@/lib/banks'
import { cx } from '@/lib/format'
import BankIcon from './BankIcon'

// An account as its bank icon plus the account's own name; the icon already says which bank it is.
export default function BankLogo({ bank, name, compact = false }: { bank?: BankId | string | null; name: string; compact?: boolean }) {
  const id = (bank || inferBank(name)) as BankId
  return <span className={cx('bank-logo', `bank-logo-${id}`, compact && 'is-compact')} title={compact ? name : undefined}>
    <BankIcon bank={id} size="sm" />
    {compact ? <span className="sr-only">{name}</span> : <span className="bank-logo-name">{name}</span>}
  </span>
}
