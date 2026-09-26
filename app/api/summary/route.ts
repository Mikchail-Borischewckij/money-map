import { getSession, privateHeaders } from '@/server/auth'
import { readSummary } from '@/server/summary'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  return Response.json(await readSummary(session), { headers: privateHeaders })
}
