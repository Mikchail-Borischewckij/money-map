import { getSession, privateHeaders } from '@/server/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  return Response.json({ displayName: session.displayName, csrfToken: session.csrfToken }, { headers: privateHeaders })
}
