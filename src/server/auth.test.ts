import { afterEach, describe, expect, it } from 'vitest'
import { allowedSubjects, validMutation, type Session } from './auth'

const previous = { first: process.env.ALLOWED_GOOGLE_SUB_1, second: process.env.ALLOWED_GOOGLE_SUB_2, origin: process.env.APP_ORIGIN }
afterEach(() => {
  process.env.ALLOWED_GOOGLE_SUB_1 = previous.first
  process.env.ALLOWED_GOOGLE_SUB_2 = previous.second
  process.env.APP_ORIGIN = previous.origin
})

describe('server authorization rules', () => {
  it('permits exactly two configured subjects, never a third Google account', () => {
    process.env.ALLOWED_GOOGLE_SUB_1 = 'google-sub-one'
    process.env.ALLOWED_GOOGLE_SUB_2 = 'google-sub-two'
    expect(allowedSubjects()).toEqual(['google-sub-one', 'google-sub-two'])
    expect(allowedSubjects().includes('google-sub-three')).toBe(false)
    process.env.ALLOWED_GOOGLE_SUB_2 = 'google-sub-one'
    expect(allowedSubjects()).toEqual([])
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
