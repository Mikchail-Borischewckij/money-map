import { afterEach, describe, expect, it } from 'vitest'
import { allowedEmails, canUseGoogleIdentity, validMutation, type Session } from './auth'

const previous = { first: process.env.ALLOWED_GOOGLE_EMAIL_1, second: process.env.ALLOWED_GOOGLE_EMAIL_2, origin: process.env.APP_ORIGIN }
afterEach(() => {
  process.env.ALLOWED_GOOGLE_EMAIL_1 = previous.first
  process.env.ALLOWED_GOOGLE_EMAIL_2 = previous.second
  process.env.APP_ORIGIN = previous.origin
})

describe('server authorization rules', () => {
  it('binds only two verified Google emails, then authorizes their existing subjects', () => {
    process.env.ALLOWED_GOOGLE_EMAIL_1 = 'First@Gmail.com'
    process.env.ALLOWED_GOOGLE_EMAIL_2 = 'second@company.example'
    expect(allowedEmails()).toEqual(['first@gmail.com', 'second@company.example'])
    expect(canUseGoogleIdentity('first@gmail.com', true)).toBe(true)
    expect(canUseGoogleIdentity('second@company.example', true, 'company.example')).toBe(true)
    expect(canUseGoogleIdentity('second@company.example', true)).toBe(false)
    expect(canUseGoogleIdentity('other@gmail.com', true)).toBe(false)
    expect(canUseGoogleIdentity('first@gmail.com', false)).toBe(false)
    expect(canUseGoogleIdentity('renamed@example.com', false, undefined, 'first@gmail.com')).toBe(true)
    expect(canUseGoogleIdentity('first@gmail.com', true, undefined, 'removed@example.com')).toBe(false)
    process.env.ALLOWED_GOOGLE_EMAIL_2 = 'FIRST@GMAIL.COM'
    expect(allowedEmails()).toEqual([])
  })

  it('rejects a mutation without the matching origin and CSRF token', () => {
    process.env.APP_ORIGIN = 'https://family.example'
    const session = { csrfToken: 'secret' } as Session
    const request = (origin: string, token?: string) => new Request('https://family.example/api/plans', { method: 'POST', headers: { Origin: origin, ...(token ? { 'X-CSRF-Token': token } : {}) } })
    expect(validMutation(request('https://family.example', 'secret'), session)).toBe(true)
    expect(validMutation(request('https://other.example', 'secret'), session)).toBe(false)
    expect(validMutation(request('https://family.example'), session)).toBe(false)
    expect(validMutation(request('https://family.example', 'wrong'), session)).toBe(false)
  })
})
