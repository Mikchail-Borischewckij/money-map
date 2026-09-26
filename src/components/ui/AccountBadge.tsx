import type { BankId } from '@/lib/banks'
import BankLogo from './BankLogo'

export default function AccountBadge({ name, bank }: { name: string; bank?: BankId | string | null; hue?: number | null }) {
  return <BankLogo bank={bank} name={name} />
}
