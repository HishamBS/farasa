/**
 * Self-contained migration script for Docker production container.
 * Uses postgres-js directly — no path aliases, no drizzle-kit CLI needed.
 * Only requires: drizzle-orm, postgres, and the drizzle/ SQL directory.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  console.error('[migrate] DATABASE_URL is not set')
  process.exit(1)
}

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client)

await migrate(db, { migrationsFolder: './drizzle' })
await client.end()

console.log('[migrate] All migrations applied.')
process.exit(0)
