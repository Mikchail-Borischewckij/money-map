import { getSession, privateHeaders } from '@/server/auth'
import { readPlanByMonth } from '@/server/plans'

export async function GET(_request: Request, context: { params: Promise<{ year: string; month: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  const { year, month } = await context.params
  const y = Number(year), m = Number(month)
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) return Response.json({ error: 'Invalid month' }, { status: 400, headers: privateHeaders })
  const plan = await readPlanByMonth(session, y, m)
  return plan ? Response.json(plan, { headers: privateHeaders }) : Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
}
