import type { Option } from '@/components/ui'
import type { PaymentSchedule } from '@/lib/schedule'

export type AccountKind = 'current' | 'savings' | 'cash'
export type AccountRow = { id: string; name: string; kind: AccountKind; can_fund_transfers: boolean; transfer_priority: number; is_archived: boolean; version: number }
export type Template = {
  id: string; name: string; default_amount: string; account_id: string; day: number | null
  active_to: string | null; category_id?: string | null; is_archived: boolean; version: number
  schedule?: PaymentSchedule; weekdays?: number[] | null; amount_varies?: boolean
}
export type Category = { id: string; name: string; is_archived: boolean; version: number }
export type TemplateKind = 'payment' | 'income'
export type TemplateForm = { name: string; amount: number; accountId: string; day: number | null; categoryId: string; schedule: PaymentSchedule; weekdays: number[]; amountVaries: boolean }

// Runs a settings change, then reloads the lists and shows the message.
export type Run = (action: () => Promise<unknown>, done: string) => Promise<void>

export const kindOptions: Option<AccountKind>[] = [{ value: 'current', label: 'Текущий' }, { value: 'savings', label: 'Накопительный' }, { value: 'cash', label: 'Наличные' }]
