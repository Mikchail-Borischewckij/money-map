import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { createPlan, listPlans } from '@/server/plans'

const monthInput = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) })

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  return Response.json(await listPlans(session), { headers: privateHeaders })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const parsed = monthInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid month' }, { status: 400, headers: privateHeaders })
  return Response.json(await createPlan(session, parsed.data.year, parsed.data.month), { headers: privateHeaders })
}
