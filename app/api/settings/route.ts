import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { readSettings, saveSettings } from '@/server/settings'
import { settingsInput } from '@/server/validation'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  return Response.json(await readSettings(session), { headers: privateHeaders })
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const parsed = settingsInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid settings' }, { status: 400, headers: privateHeaders })
  return Response.json(await saveSettings(session, parsed.data.periodStartDay), { headers: privateHeaders })
}
