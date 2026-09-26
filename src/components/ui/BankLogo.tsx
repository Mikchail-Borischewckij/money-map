import { bankName, inferBank, type BankId } from '@/lib/banks'
import { cx } from '@/lib/format'

export default function BankLogo({ bank, name, compact = false }: { bank?: BankId | string | null; name?: string; compact?: boolean }) {
  const id = (bank || inferBank(name ?? '')) as BankId
  const label = bankName(id)
  const mark = id === 'pko' ? 'PKO' : id === 'credit-agricole' ? 'CA' : id === 'revolut' ? 'R' : 'B'
  return <span className={cx('bank-logo', `bank-logo-${id}`, compact && 'is-compact')} aria-label={name ? `${label}, ${name}` : label}>
    <span className="bank-logo-mark" aria-hidden="true">{mark}</span>
    {!compact && <span className="bank-logo-copy"><span className="bank-logo-name">{label}</span>{name && name !== label && <small>{name}</small>}</span>}
  </span>
}
