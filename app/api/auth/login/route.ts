import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { allowedEmails, hasAppOrigin, randomToken, resolveAppOrigin } from '@/server/auth'

export async function GET(request: Request) {
  if (allowedEmails().length === 0 || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !hasAppOrigin() || !process.env.DATABASE_URL) {
    return new Response('Authentication is not configured', { status: 503 })
  }
  const state = randomToken()
  const nonce = randomToken()
  const verifier = randomToken()
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const callback = new URL('/api/auth/callback', resolveAppOrigin(request.url)).toString()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callback,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  const response = NextResponse.redirect(url)
  const settings = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 600, path: '/' }
  response.cookies.set('mm_oidc_state', state, settings)
  response.cookies.set('mm_oidc_nonce', nonce, settings)
  response.cookies.set('mm_oidc_verifier', verifier, settings)
  return response
}
