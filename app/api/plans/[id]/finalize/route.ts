import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { db } from '@/server/db'
import { changePlanStatus } from '@/server/plans'
import { storeMonthRate } from '@/server/usd-rate'
import { uuid } from '@/server/validation'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const parsed = z.object({ expectedVersion: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid version' }, { status: 400, headers: privateHeaders })
  const result = await changePlanStatus(session, id, 'finalize', parsed.data.expectedVersion)
  // The dollar rate is kept with the closed month; if NBP does not answer now, the summary asks again later.
  if (result.result === 'saved' && result.current) {
    const [year, month] = result.current.plan.month.split('-').map(Number)
    await storeMonthRate(db(), { id, year, month, start_day: result.current.plan.startDay ?? 1 })
  }
  return Response.json(result.result === 'incomplete' ? { error: 'Check opening balances and payments before finalizing' } : result.current ?? { error: 'Not found' }, { status: result.result === 'saved' ? 200 : result.result === 'missing' ? 404 : result.result === 'incomplete' ? 422 : 409, headers: privateHeaders })
}
