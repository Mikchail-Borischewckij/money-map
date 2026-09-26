import Image from 'next/image'

import type { BankId } from '@/lib/banks'
import { cx } from '@/lib/format'

const bankIconSources: Partial<Record<BankId, string>> = {
  pko: '/banks/pko.jpg',
  'credit-agricole': '/banks/credit-agricole.jpg',
  revolut: '/banks/revolut.svg',
}

export default function BankIcon({ bank, size = 'md' }: { bank: BankId; size?: 'sm' | 'md' | 'lg' }) {
  const source = bankIconSources[bank]

  return <span className={cx('bank-icon', `bank-icon-${bank}`, `bank-icon-${size}`)} aria-hidden="true">
    {source
      ? <Image src={source} alt="" width={64} height={64} priority={false} />
      : <svg viewBox="0 0 32 32" focusable="false">
        <path d="M4.5 12.5 16 5l11.5 7.5M6.5 13.5h19M8 14.5v9M13.3 14.5v9M18.7 14.5v9M24 14.5v9M5 25.5h22" />
      </svg>}
  </span>
}
