import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { db } from '@/server/db'
import { uuid } from '@/server/validation'

// Brings an archived account back as the last one in the transfer order. The open month shows it again;
// closed months are not touched.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const parsed = z.object({ expectedVersion: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid version' }, { status: 400, headers: privateHeaders })
  const rows = await db().begin(async (tx) => {
    const restored = await tx`UPDATE accounts SET is_archived = false, version = version + 1, updated_at = now(),
      transfer_priority = (SELECT COALESCE(MAX(transfer_priority), 0) + 10 FROM accounts WHERE household_id = ${session.householdId} AND is_archived = false)
      WHERE id = ${id} AND household_id = ${session.householdId} AND is_archived = true AND version = ${parsed.data.expectedVersion} RETURNING id, version`
    if (restored[0]) await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'Account', ${id}, 'restore', ${parsed.data.expectedVersion}, ${parsed.data.expectedVersion + 1})`
    return restored
  })
  if (rows[0]) return Response.json(rows[0], { headers: privateHeaders })
  const exists = await db()`SELECT id FROM accounts WHERE id = ${id} AND household_id = ${session.householdId}`
  return Response.json({ error: exists[0] ? 'Version conflict' : 'Not found' }, { status: exists[0] ? 409 : 404, headers: privateHeaders })
}
