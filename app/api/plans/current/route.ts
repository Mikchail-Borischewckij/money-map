import { getSession, privateHeaders } from '@/server/auth'
import { currentMonth } from '@/server/plans'

// The open month, or the last closed one with the month that can be started next.
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  const { record, next } = await currentMonth(session)
  return Response.json({ record, next }, { headers: privateHeaders })
}
