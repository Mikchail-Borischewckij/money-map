import { readFile } from 'node:fs/promises'
import postgres from 'postgres'

const connection = process.env.DATABASE_URL
if (!connection) throw new Error('DATABASE_URL is required')

const sql = postgres(connection, {
  ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
  prepare: false,
  max: 1,
})

try {
  const migration = await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8')
  await sql.begin(async (transaction) => {
    await transaction.unsafe('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    const applied = await transaction`SELECT name FROM schema_migrations WHERE name = '001_initial'`
    if (applied.length === 0) {
      await transaction.unsafe(migration)
      await transaction`INSERT INTO schema_migrations (name) VALUES ('001_initial') ON CONFLICT (name) DO NOTHING`
    }
  })
  console.log('Database migration 001_initial is ready')
} finally {
  await sql.end()
}
