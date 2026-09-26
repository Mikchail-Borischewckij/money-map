import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { db } from '@/server/db'

const input = z.object({ name: z.string().trim().min(1).max(100), kind: z.enum(['payment', 'income']).default('payment') })

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  // `in_use`: a regular payment or income refers to it (in any version), so it can only be archived, not deleted.
  return Response.json(await db()`SELECT c.id, c.name, c.kind, c.display_order, c.is_archived, c.version,
    (EXISTS (SELECT 1 FROM recurring_payments p WHERE p.category_id = c.id) OR EXISTS (SELECT 1 FROM payment_template_versions v WHERE v.category_id = c.id)
      OR EXISTS (SELECT 1 FROM recurring_incomes i WHERE i.category_id = c.id) OR EXISTS (SELECT 1 FROM income_template_versions w WHERE w.category_id = c.id)) AS in_use
    FROM categories c WHERE c.household_id = ${session.householdId} ORDER BY c.display_order, c.name`, { headers: privateHeaders })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const parsed = input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid category' }, { status: 400, headers: privateHeaders })
  const rows = await db()`INSERT INTO categories (household_id, name, kind) VALUES (${session.householdId}, ${parsed.data.name}, ${parsed.data.kind}) RETURNING id, name, kind, version`
  return Response.json(rows[0], { status: 201, headers: privateHeaders })
}
