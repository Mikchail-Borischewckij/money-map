import type { Option } from '@/components/ui'
import type { BankId } from '@/lib/banks'
import type { PaymentSchedule } from '@/lib/schedule'

export type AccountKind = 'current' | 'savings' | 'cash' | 'business'
export type AccountRow = { id: string; name: string; bank: BankId; kind: AccountKind; can_fund_transfers: boolean; transfer_priority: number; is_archived: boolean; version: number; sweep_to_account_id?: string | null; keep_amount?: string | number }
export type Template = {
  id: string; name: string; default_amount: string; account_id: string; day: number | null
  active_to: string | null; category_id?: string | null; is_archived: boolean; version: number
  schedule?: PaymentSchedule; weekdays?: number[] | null; amount_varies?: boolean
}
export type CategoryKind = 'payment' | 'income'
export type Category = { id: string; name: string; kind: CategoryKind; is_archived: boolean; version: number; in_use?: boolean }
export type TemplateKind = 'payment' | 'income'
export type TemplateForm = { name: string; amount: number; accountId: string; day: number | null; categoryId: string; schedule: PaymentSchedule; weekdays: number[]; amountVaries: boolean }

export type Lists = { accounts: AccountRow[]; payments: Template[]; incomes: Template[]; categories: Category[]; periodStartDay: number }
// How the lists look right after a change, shown before the server answers.
export type Preview = (lists: Lists) => Lists
// Runs a settings change, then reloads the lists and shows the message.
export type Run = (action: () => Promise<unknown>, done: string, preview?: Preview) => Promise<void>

export const kindOptions: Option<AccountKind>[] = [{ value: 'current', label: 'Текущий' }, { value: 'savings', label: 'Накопительный' }, { value: 'cash', label: 'Наличные' }, { value: 'business', label: 'Бизнес' }]
