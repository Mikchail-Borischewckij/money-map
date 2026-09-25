import { createRemoteJWKSet, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { canUseGoogleIdentity, hashToken, randomToken, sessionCookie } from '@/server/auth'
import { db } from '@/server/db'

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export async function GET(request: Request) {
  const url = new URL(request.url)
  const cookieStore = await cookies()
  const state = cookieStore.get('mm_oidc_state')?.value
  const nonce = cookieStore.get('mm_oidc_nonce')?.value
  const verifier = cookieStore.get('mm_oidc_verifier')?.value
  const code = url.searchParams.get('code')
  if (!state || !nonce || !verifier || !code || url.searchParams.get('state') !== state) {
    return NextResponse.redirect(new URL('/?error=login', request.url))
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.APP_ORIGIN) {
    return new Response('Authentication is not configured', { status: 503 })
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: new URL('/api/auth/callback', process.env.APP_ORIGIN).toString(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    cache: 'no-store',
  })
  if (!tokenResponse.ok) return NextResponse.redirect(new URL('/?error=login', request.url))
  const tokens = await tokenResponse.json() as { id_token?: string }
  if (!tokens.id_token) return NextResponse.redirect(new URL('/?error=login', request.url))

  let identity: { sub: string; email: string; emailVerified: boolean; hostedDomain?: string; name: string }
  try {
    const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
      audience: process.env.GOOGLE_CLIENT_ID,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    })
    if (payload.nonce !== nonce || typeof payload.sub !== 'string') throw new Error('Invalid identity')
    identity = {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
      emailVerified: payload.email_verified === true,
      hostedDomain: typeof payload.hd === 'string' ? payload.hd : undefined,
      name: typeof payload.name === 'string' ? payload.name : 'Пользователь',
    }
  } catch {
    return NextResponse.redirect(new URL('/?error=login', request.url))
  }
  const bound = await db()`SELECT id, initial_email, is_active FROM users WHERE google_subject = ${identity.sub}`
  if (!canUseGoogleIdentity(identity.email, identity.emailVerified, identity.hostedDomain, bound[0]?.initial_email)) {
    return NextResponse.redirect(new URL('/?error=denied', request.url))
  }

  const rows = bound.length
    ? await db()`UPDATE users SET email = ${identity.email}, display_name = ${identity.name}, updated_at = now()
        WHERE id = ${bound[0].id} AND google_subject = ${identity.sub} RETURNING id, is_active`
    : await db()`INSERT INTO users (household_id, google_subject, initial_email, email, display_name)
        SELECT id, ${identity.sub}, ${identity.email.trim().toLowerCase()}, ${identity.email}, ${identity.name}
        FROM households WHERE singleton = true
        ON CONFLICT (initial_email) DO UPDATE
          SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, updated_at = now()
          WHERE users.google_subject = EXCLUDED.google_subject
        RETURNING id, is_active`
  if (!rows[0]?.is_active) return NextResponse.redirect(new URL('/?error=denied', request.url))
  const token = randomToken()
  const csrf = randomToken()
  await db()`INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at)
    VALUES (${hashToken(token)}, ${rows[0].id}, ${csrf}, now() + interval '30 days')`
  const response = NextResponse.redirect(new URL('/', process.env.APP_ORIGIN))
  const settings = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' }
  response.cookies.set(sessionCookie, token, { ...settings, maxAge: 60 * 60 * 24 * 30 })
  for (const name of ['mm_oidc_state', 'mm_oidc_nonce', 'mm_oidc_verifier']) response.cookies.set(name, '', { ...settings, maxAge: 0 })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
