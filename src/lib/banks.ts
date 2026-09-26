export const bankIds = ['pko', 'credit-agricole', 'revolut', 'other', 'cash'] as const

export type BankId = typeof bankIds[number]

// Banks to pick from; cash is not a bank and comes from the account type.
export const bankOptions: { value: Exclude<BankId, 'cash'>; label: string }[] = [
  { value: 'pko', label: 'PKO Bank Polski' },
  { value: 'credit-agricole', label: 'Credit Agricole' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'other', label: 'Другой банк' },
]

export function inferBank(name: string): BankId {
  const normalized = name.toLocaleLowerCase('ru')
  if (normalized.includes('pko')) return 'pko'
  if (normalized.includes('agricole') || normalized.includes('креди')) return 'credit-agricole'
  if (normalized.includes('revolut') || normalized.includes('револют')) return 'revolut'
  if (normalized.includes('налич')) return 'cash'
  return 'other'
}
