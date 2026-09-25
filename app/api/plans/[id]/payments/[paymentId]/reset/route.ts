import { z } from 'zod'
import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { resetMonthlyPayment } from '@/server/plans'
import { uuid } from '@/server/validation'

export async function POST(request: Request, context: { params: Promise<{ id: string; paymentId: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const { id, paymentId } = await context.params
  if (!uuid.safeParse(id).success || !uuid.safeParse(paymentId).success) return Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
  const parsed = z.object({ expectedVersion: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid version' }, { status: 400, headers: privateHeaders })
  const value = await resetMonthlyPayment(session, id, paymentId, parsed.data.expectedVersion)
  return Response.json(value.current ?? { error: 'Not found' }, { status: value.result === 'saved' ? 200 : value.result === 'missing' ? 404 : 409, headers: privateHeaders })
}
