import postgres from 'postgres'

let client: ReturnType<typeof postgres> | undefined

export function db() {
  if (!client) {
    const connection = process.env.DATABASE_URL
    if (!connection) throw new Error('DATABASE_URL is not configured')
    client = postgres(connection, {
      ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
      prepare: false,
      max: 3,
      idle_timeout: 20,
    })
  }
  return client
}

// Integer arrays are sent as literals with an explicit cast; with prepare: false postgres.js cannot infer the parameter type.
export const intArray = (values: number[] | null | undefined) => values ? `{${values.map((value) => Math.trunc(value)).join(',')}}` : null
