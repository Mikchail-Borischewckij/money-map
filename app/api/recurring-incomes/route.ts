import { getSession, privateHeaders, validMutation } from '@/server/auth'
import { createTemplate, listTemplates } from '@/server/templates'
import { templateInput } from '@/server/validation'

export async function GET() {
  const session = await getSession()
  return session ? Response.json(await listTemplates(session, 'income'), { headers: privateHeaders }) : Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
}
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  const parsed = templateInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid template' }, { status: 400, headers: privateHeaders })
  const row = await createTemplate(session, 'income', parsed.data)
  return Response.json(row ?? { error: 'Invalid account' }, { status: row ? 201 : 400, headers: privateHeaders })
}
