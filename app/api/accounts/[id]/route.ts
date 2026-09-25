import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { db } from '@/server/db'
import { accountFields } from '@/server/accounts'
import { accountInput, uuid } from '@/server/validation'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: Context) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const parsed = accountInput.extend({ version: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid account' }, { status: 400, headers: privateHeaders })
  const value = await accountFields(session, parsed.data, id)
  if (!value) return Response.json({ error: 'Invalid account' }, { status: 400, headers: privateHeaders })
  const updated = await db().begin(async (tx) => {
    const rows = await tx`UPDATE accounts SET name = ${value.name}, type = ${value.kind}, can_fund_transfers = ${value.canFundTransfers},
      transfer_priority = ${value.priority}, sweep_to_account_id = ${value.sweepToAccountId}, keep_amount = ${value.keepAmount}, version = version + 1, updated_at = now()
      WHERE id = ${id} AND household_id = ${session.householdId} AND version = ${value.version} AND is_archived = false RETURNING *`
    if (rows[0]) await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'Account', ${id}, 'update', ${value.version}, ${value.version + 1})`
    return rows[0]
  })
  if (updated) return Response.json(updated, { headers: privateHeaders })
  const current = await db()`SELECT id, name, type, can_fund_transfers, transfer_priority, version FROM accounts
    WHERE id = ${id} AND household_id = ${session.householdId}`
  return Response.json(current[0] ? { error: 'Version conflict', current: current[0] } : { error: 'Not found' }, { status: current[0] ? 409 : 404, headers: privateHeaders })
}

export async function DELETE(request: Request, context: Context) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const parsed = z.object({ expectedVersion: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid version' }, { status: 400, headers: privateHeaders })
  const rows = await db().begin(async (tx) => {
    const archived = await tx`UPDATE accounts SET is_archived = true, version = version + 1, updated_at = now()
      WHERE id = ${id} AND household_id = ${session.householdId} AND is_archived = false AND version = ${parsed.data.expectedVersion} RETURNING id, version`
    // A business account that sent its rest here stops doing so; it can be pointed at another account in settings.
    if (archived[0]) await tx`UPDATE accounts SET sweep_to_account_id = NULL, version = version + 1, updated_at = now() WHERE sweep_to_account_id = ${id}`
    if (archived[0]) await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'Account', ${id}, 'archive', ${parsed.data.expectedVersion}, ${parsed.data.expectedVersion + 1})`
    return archived
  })
  if (rows[0]) return Response.json(rows[0], { headers: privateHeaders })
  const exists = await db()`SELECT id FROM accounts WHERE id = ${id} AND household_id = ${session.householdId}`
  return Response.json({ error: exists[0] ? 'Version conflict' : 'Not found' }, { status: exists[0] ? 409 : 404, headers: privateHeaders })
}
