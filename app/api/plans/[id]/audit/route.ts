import { getSession, privateHeaders } from '@/server/auth'
import { db } from '@/server/db'
import { uuid } from '@/server/validation'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const rows = await db()`SELECT e.action, e.old_version, e.new_version, e.occurred_at, u.display_name AS actor
    FROM audit_events e JOIN users u ON u.id = e.actor_id JOIN monthly_plans p ON p.id = e.entity_id
    WHERE e.household_id = ${session.householdId} AND p.household_id = ${session.householdId} AND e.entity_id = ${id}
    ORDER BY e.occurred_at DESC`
  return Response.json(rows, { headers: privateHeaders })
}
