import { readdir, readFile } from 'node:fs/promises'
import postgres from 'postgres'

// On Vercel, migrate only production deployments: preview builds must not touch the production database.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
  console.log(`Skipping database migrations for ${process.env.VERCEL_ENV} deployment`)
  process.exit(0)
}

// Vercel builds have no IPv6, so the Supabase direct connection is unreachable there.
// MIGRATION_DATABASE_URL should be the Session pooler string; the Transaction pooler is not suitable for DDL.
const source = process.env.MIGRATION_DATABASE_URL ? 'MIGRATION_DATABASE_URL' : 'DATABASE_URL'
const connection = process.env[source]
if (!connection) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required')

const { hostname, port } = new URL(connection)
console.log(`Migrating via ${source} at ${hostname}:${port || 5432}`)
if (process.env.VERCEL && /^db\..+\.supabase\.co$/.test(hostname)) {
  throw new Error(`${source} points to the IPv6-only Supabase direct connection; use the Session pooler string (*.pooler.supabase.com:5432)`)
}

const sql = postgres(connection, {
  ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
  prepare: false,
  max: 1,
})

const directory = new URL('../db/migrations/', import.meta.url)

try {
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
  await sql.begin(async (transaction) => {
    // Serialize concurrent deployments; the lock is released when the transaction ends.
    await transaction`SELECT pg_advisory_xact_lock(hashtext('money-map-migrations'))`
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
