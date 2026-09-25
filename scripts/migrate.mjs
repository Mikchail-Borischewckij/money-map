import { readdir, readFile } from 'node:fs/promises'
import postgres from 'postgres'

const connection = process.env.DATABASE_URL
if (!connection) throw new Error('DATABASE_URL is required')

const sql = postgres(connection, {
  ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
  prepare: false,
  max: 1,
})

const directory = new URL('../db/migrations/', import.meta.url)

try {
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
  await sql.begin(async (transaction) => {
    await transaction.unsafe('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    for (const file of files) {
      const name = file.replace(/\.sql$/, '')
      const applied = await transaction`SELECT name FROM schema_migrations WHERE name = ${name}`
      if (applied.length > 0) continue
      await transaction.unsafe(await readFile(new URL(file, directory), 'utf8'))
      await transaction`INSERT INTO schema_migrations (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`
      console.log(`Applied ${name}`)
    }
  })
  console.log('Database migrations are up to date')
} finally {
  await sql.end()
}
