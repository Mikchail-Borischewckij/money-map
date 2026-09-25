import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { updateTemplate } from '@/server/templates'
import { templateInput, uuid } from '@/server/validation'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const parsed = templateInput.safeExtend({ version: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid template' }, { status: 400, headers: privateHeaders })
  const row = await updateTemplate(session, 'payment', id, parsed.data)
  return Response.json(row ?? { error: 'Not found or version conflict' }, { status: row ? 200 : 409, headers: privateHeaders })
}
