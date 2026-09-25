import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { expect, it } from 'vitest'

it('applies the initial PostgreSQL migration and enforces one plan per month', async () => {
  const pg = new PGlite({ extensions: { pgcrypto } })
  try {
    const migration = await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8')
    await pg.exec(migration)
    const household = await pg.query<{ id: string }>('SELECT id FROM households')
    expect(household.rows).toHaveLength(1)
    const householdId = household.rows[0].id
    const user = await pg.query<{ id: string }>('INSERT INTO users (household_id, google_subject, initial_email, email, display_name) VALUES ($1, $2, $3, $4, $5) RETURNING id', [householdId, 'synthetic-google-sub', 'test@example.invalid', 'test@example.invalid', 'Test'])
    const userId = user.rows[0].id
    const rebinding = await pg.query<{ id: string }>(
      'INSERT INTO users (household_id, google_subject, initial_email, email, display_name) VALUES ($1, $2, $3, $3, $4) ON CONFLICT (initial_email) DO UPDATE SET email = EXCLUDED.email WHERE users.google_subject = EXCLUDED.google_subject RETURNING id',
      [householdId, 'different-google-sub', 'test@example.invalid', 'Impostor'],
    )
    expect(rebinding.rows).toHaveLength(0)
    await pg.query('INSERT INTO monthly_plans (household_id, year, month, created_by, updated_by) VALUES ($1, 2026, 10, $2, $2)', [householdId, userId])
    await expect(pg.query('INSERT INTO monthly_plans (household_id, year, month, created_by, updated_by) VALUES ($1, 2026, 10, $2, $2)', [householdId, userId])).rejects.toThrow()
  } finally {
    await pg.close()
  }
})

it('adds users.initial_email to databases created by the early initial migration', async () => {
  const pg = new PGlite({ extensions: { pgcrypto } })
  try {
    const initial = await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8')
    const upgrade = await readFile(new URL('./migrations/002_users_initial_email.sql', import.meta.url), 'utf8')
    await pg.exec(initial)
    await pg.exec('ALTER TABLE users DROP COLUMN initial_email')
    await pg.exec(upgrade)
    await pg.exec(upgrade)
    const household = await pg.query<{ id: string }>('SELECT id FROM households')
    const insert = 'INSERT INTO users (household_id, google_subject, initial_email, email, display_name) VALUES ($1, $2, $3, $3, $4)'
    await pg.query(insert, [household.rows[0].id, 'sub-1', 'test@example.invalid', 'Test'])
    await expect(pg.query(insert, [household.rows[0].id, 'sub-2', 'test@example.invalid', 'Test'])).rejects.toThrow()
    await expect(pg.query(insert, [household.rows[0].id, 'sub-3', 'Upper@example.invalid', 'Test'])).rejects.toThrow()
  } finally {
    await pg.close()
  }
})
