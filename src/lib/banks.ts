export const bankIds = ['pko', 'credit-agricole', 'revolut', 'other'] as const

export type BankId = typeof bankIds[number]

export const bankOptions: { value: BankId; label: string }[] = [
  { value: 'pko', label: 'PKO Bank Polski' },
  { value: 'credit-agricole', label: 'Credit Agricole' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'other', label: 'Другой банк' },
]

export const bankName = (bank?: string | null) => bankOptions.find((option) => option.value === bank)?.label ?? 'Банк'

export function inferBank(name: string): BankId {
  const normalized = name.toLocaleLowerCase('ru')
  if (normalized.includes('pko')) return 'pko'
  if (normalized.includes('agricole') || normalized.includes('креди')) return 'credit-agricole'
  if (normalized.includes('revolut') || normalized.includes('револют')) return 'revolut'
  return 'other'
}
