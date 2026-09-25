import { getSession, privateHeaders } from '@/server/auth'
import { planTemplateChanges } from '@/server/plans'
import { uuid } from '@/server/validation'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const value = await planTemplateChanges(session, id)
  if (value.result === 'missing') return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  if (value.result === 'finalized') return Response.json({ error: 'Plan is finalized' }, { status: 409, headers: privateHeaders })
  return Response.json({ version: value.version, changes: value.changes }, { headers: privateHeaders })
}
