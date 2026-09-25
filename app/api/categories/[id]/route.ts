import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { db } from '@/server/db'
import { uuid } from '@/server/validation'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const parsed = z.object({ name: z.string().trim().min(1).max(100), version: z.number().int().positive(), isArchived: z.boolean() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid category' }, { status: 400, headers: privateHeaders })
  const rows = await db()`UPDATE categories SET name = ${parsed.data.name}, is_archived = ${parsed.data.isArchived}, version = version + 1, updated_at = now()
    WHERE id = ${id} AND household_id = ${session.householdId} AND version = ${parsed.data.version} RETURNING id, name, is_archived, version`
  return Response.json(rows[0] ?? { error: 'Not found or version conflict' }, { status: rows[0] ? 200 : 409, headers: privateHeaders })
}
