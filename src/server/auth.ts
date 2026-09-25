import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from './db'

export const sessionCookie = process.env.NODE_ENV === 'production' ? '__Host-moneymap' : 'moneymap_session'

export type Session = {
  userId: string
  householdId: string
  googleSubject: string
  displayName: string
  csrfToken: string
  tokenHash: string
}

export function allowedEmails() {
  const emails = [process.env.ALLOWED_GOOGLE_EMAIL_1, process.env.ALLOWED_GOOGLE_EMAIL_2]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))
  return emails.length > 0 && emails.every((value) => value.includes('@')) && new Set(emails).size === emails.length ? emails : []
}

export function canUseGoogleIdentity(email: string, emailVerified: boolean, hostedDomain?: string, boundInitialEmail?: string) {
  const allowlist = allowedEmails()
  if (allowlist.length === 0) return false
  if (boundInitialEmail) return allowlist.includes(boundInitialEmail)
  const normalized = email.trim().toLowerCase()
  const domain = normalized.split('@')[1]
  const googleOwnsEmail = domain === 'gmail.com' || Boolean(hostedDomain && hostedDomain.toLowerCase() === domain)
  return emailVerified && googleOwnsEmail && allowlist.includes(normalized)
}

export function randomToken() { return randomBytes(32).toString('base64url') }
export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(sessionCookie)?.value
  if (!token || allowedEmails().length === 0 || !process.env.DATABASE_URL) return null
  const tokenHash = hashToken(token)
  const rows = await db()`
    SELECT u.id AS user_id, u.household_id, u.google_subject, u.initial_email, u.display_name, s.csrf_token
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.revoked_at IS NULL AND s.expires_at > now() AND u.is_active = true
  `
  const row = rows[0]
  if (!row || !allowedEmails().includes(row.initial_email)) return null
  return {
    userId: row.user_id,
    householdId: row.household_id,
    googleSubject: row.google_subject,
    displayName: row.display_name,
    csrfToken: row.csrf_token,
    tokenHash,
  }
}

export function validMutation(request: Request, session: Session) {
  const origin = request.headers.get('origin')
  const expectedOrigin = process.env.APP_ORIGIN ?? new URL(request.url).origin
  const supplied = request.headers.get('x-csrf-token')
  if (origin !== expectedOrigin || !supplied) return false
  const left = Buffer.from(supplied)
  const right = Buffer.from(session.csrfToken)
  return left.length === right.length && timingSafeEqual(left, right)
}

export const privateHeaders = { 'Cache-Control': 'private, no-store' }
