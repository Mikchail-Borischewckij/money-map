import { NextResponse } from 'next/server'
import { getSession, privateHeaders, sessionCookie, validMutation } from '@/server/auth'
import { db } from '@/server/db'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders })
  if (!validMutation(request, session)) return Response.json({ error: 'Invalid request' }, { status: 403, headers: privateHeaders })
  await db()`UPDATE sessions SET revoked_at = now() WHERE token_hash = ${session.tokenHash}`
  const response = NextResponse.json({ ok: true }, { headers: privateHeaders })
  response.cookies.set(sessionCookie, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
