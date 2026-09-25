import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { readPlan, savePlan } from '@/server/plans'
import { uuid } from '@/server/validation'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const plan = await readPlan(session, id)
  return plan ? Response.json(plan, { headers: privateHeaders }) : Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
}

export async function PUT(request: Request, context: Context) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const body = await request.json().catch(() => null)
  try {
    const { result, current } = await savePlan(session, id, body)
    if (result === 'missing') return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
    if (result === 'conflict') return Response.json({ error: 'Version conflict', current }, { status: 409, headers: privateHeaders })
    if (result === 'finalized') return Response.json({ error: 'Plan is finalized', current }, { status: 423, headers: privateHeaders })
    if (result === 'invalid') return Response.json({ error: 'Invalid plan' }, { status: 400, headers: privateHeaders })
    return Response.json(current, { headers: privateHeaders })
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) return Response.json({ error: 'Invalid plan' }, { status: 400, headers: privateHeaders })
    throw error
  }
}
