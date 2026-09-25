import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { listPlans, startMonth } from '@/server/plans'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  return Response.json(await listPlans(session), { headers: privateHeaders })
}

// Starts the next month; the server decides which one. Returns the open month if there already is one.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  return Response.json(await startMonth(session), { headers: privateHeaders })
}
