import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { readPlan } from '@/server/plans'
import { uuid } from '@/server/validation'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const plan = await readPlan(session, id)
  return plan ? Response.json(plan.summary, { headers: privateHeaders }) : Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
}
