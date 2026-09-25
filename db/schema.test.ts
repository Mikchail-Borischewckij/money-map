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

it('stores weekly payment schedules and keeps per-unit amounts consistent', async () => {
  const pg = new PGlite({ extensions: { pgcrypto } })
  try {
    for (const file of ['001_initial.sql', '002_users_initial_email.sql', '003_payment_schedules.sql']) {
      await pg.exec(await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8'))
    }
    const household = (await pg.query<{ id: string }>('SELECT id FROM households')).rows[0].id
    const user = (await pg.query<{ id: string }>("INSERT INTO users (household_id, google_subject, initial_email, email, display_name) VALUES ($1, 's', 't@example.invalid', 't@example.invalid', 'T') RETURNING id", [household])).rows[0].id
    const account = (await pg.query<{ id: string }>("INSERT INTO accounts (household_id, name) VALUES ($1, 'Main') RETURNING id", [household])).rows[0].id
    const insertTemplate = "INSERT INTO recurring_payments (household_id, name, default_amount, account_id, active_from, schedule, weekdays) VALUES ($1, 'Pool', 7000, $2, '2026-10-01', $3, $4::integer[])"
    await pg.query(insertTemplate, [household, account, 'weekly', '{1,4}'])
    await pg.query(insertTemplate, [household, account, 'monthly', null])
    await expect(pg.query(insertTemplate, [household, account, 'weekly', null])).rejects.toThrow()
    await expect(pg.query(insertTemplate, [household, account, 'weekly', '{0}'])).rejects.toThrow()
    await expect(pg.query(insertTemplate, [household, account, 'monthly', '{1}'])).rejects.toThrow()

    const plan = (await pg.query<{ id: string }>('INSERT INTO monthly_plans (household_id, year, month, created_by, updated_by) VALUES ($1, 2026, 10, $2, $2) RETURNING id', [household, user])).rows[0].id
    const insertPayment = "INSERT INTO monthly_payments (monthly_plan_id, name_snapshot, amount, account_id, unit_price, quantity) VALUES ($1, 'Pool', $2, $3, $4, $5)"
    await pg.query(insertPayment, [plan, 63000, account, 7000, 9])
    await pg.query(insertPayment, [plan, 5000, account, null, null])
    await expect(pg.query(insertPayment, [plan, 60000, account, 7000, 9])).rejects.toThrow()
    await expect(pg.query(insertPayment, [plan, 7000, account, 7000, null])).rejects.toThrow()
  } finally {
    await pg.close()
  }
})

it('removes old months, keeps one open month per household and adds starter categories once', async () => {
  const pg = new PGlite({ extensions: { pgcrypto } })
  try {
    for (const file of ['001_initial.sql', '002_users_initial_email.sql', '003_payment_schedules.sql']) {
      await pg.exec(await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8'))
    }
    const household = (await pg.query<{ id: string }>('SELECT id FROM households')).rows[0].id
    const user = (await pg.query<{ id: string }>("INSERT INTO users (household_id, google_subject, initial_email, email, display_name) VALUES ($1, 's', 't@example.invalid', 't@example.invalid', 'T') RETURNING id", [household])).rows[0].id
    const plan = 'INSERT INTO monthly_plans (household_id, year, month, status, created_by, updated_by) VALUES ($1, 2026, $2, $3, $4, $4)'
    await pg.query(plan, [household, 9, 'Draft', user])
    await pg.query(plan, [household, 10, 'Draft', user])
    await pg.query("INSERT INTO categories (household_id, name) VALUES ($1, 'жильё')", [household])
    await pg.exec(await readFile(new URL('./migrations/004_single_open_month.sql', import.meta.url), 'utf8'))
    expect((await pg.query('SELECT id FROM monthly_plans')).rows).toHaveLength(0)
    const categories = await pg.query<{ name: string }>('SELECT name FROM categories ORDER BY display_order, name')
    expect(categories.rows).toHaveLength(12)
    expect(categories.rows.map((row) => row.name)).toContain('жильё')
    await pg.query(plan, [household, 9, 'Finalized', user])
    await pg.query(plan, [household, 10, 'Draft', user])
    await expect(pg.query(plan, [household, 11, 'Draft', user])).rejects.toThrow()
  } finally {
    await pg.close()
  }
})
