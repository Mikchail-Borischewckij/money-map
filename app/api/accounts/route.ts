import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { db } from '@/server/db'
import { accountInput } from '@/server/validation'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  const rows = await db()`SELECT id, name, type AS kind, display_order, can_fund_transfers, transfer_priority, is_archived, version
    FROM accounts WHERE household_id = ${session.householdId} ORDER BY display_order, id`
  return Response.json(rows, { headers: privateHeaders })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const parsed = accountInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid account' }, { status: 400, headers: privateHeaders })
  const value = parsed.data
  const rows = await db().begin(async (tx) => {
    const created = await tx`INSERT INTO accounts (household_id, name, type, can_fund_transfers, transfer_priority, display_order)
      VALUES (${session.householdId}, ${value.name}, ${value.kind}, ${value.canFundTransfers}, ${value.priority},
      (SELECT COALESCE(MAX(display_order), 0) + 1 FROM accounts WHERE household_id = ${session.householdId})) RETURNING *`
    await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version)
      VALUES (${session.householdId}, ${session.userId}, 'Account', ${created[0].id}, 'create', 1)`
    return created
  })
  return Response.json(rows[0], { status: 201, headers: privateHeaders })
}
