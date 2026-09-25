import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { db } from '@/server/db'

const input = z.object({ name: z.string().trim().min(1).max(100) })

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  return Response.json(await db()`SELECT id, name, display_order, is_archived, version FROM categories WHERE household_id = ${session.householdId} ORDER BY display_order, name`, { headers: privateHeaders })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const parsed = input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid category' }, { status: 400, headers: privateHeaders })
  const rows = await db()`INSERT INTO categories (household_id, name) VALUES (${session.householdId}, ${parsed.data.name}) RETURNING id, name, version`
  return Response.json(rows[0], { status: 201, headers: privateHeaders })
}
