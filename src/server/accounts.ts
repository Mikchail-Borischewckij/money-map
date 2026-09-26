import type { Session } from './auth'
import { db } from './db'
import type { accountInput } from './validation'
import type { z } from 'zod'

type AccountValue = z.infer<typeof accountInput>

// Business accounts never fund other accounts directly and send their rest to one open personal account;
// other accounts carry no sweep. Any account may keep an amount untouched (`keepAmount`). Cash has no bank and never funds transfers.
// Returns null when the target is not allowed.
export async function accountFields<T extends AccountValue>(session: Session, value: T, id?: string): Promise<T | null> {
  if (value.kind === 'cash') return { ...value, bank: 'cash', canFundTransfers: false, sweepToAccountId: null }
  if (value.bank === 'cash') value = { ...value, bank: 'other' }
  if (value.kind !== 'business') return { ...value, sweepToAccountId: null }
  if (!value.sweepToAccountId) return { ...value, canFundTransfers: false }
  if (value.sweepToAccountId === id) return null
  const target = await db()`SELECT id FROM accounts WHERE id = ${value.sweepToAccountId} AND household_id = ${session.householdId} AND is_archived = false AND type <> 'business'`
  return target[0] ? { ...value, canFundTransfers: false } : null
}
