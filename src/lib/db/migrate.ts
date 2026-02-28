import { neon } from '@neondatabase/serverless'
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http'
import { migrate as neonMigrate } from 'drizzle-orm/neon-http/migrator'
import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js'
import { migrate as postgresMigrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { isNeonUrl } from './utils'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to run migrations. Check .env.example.')
}

if (isNeonUrl(databaseUrl)) {
  const db = neonDrizzle(neon(databaseUrl))
  await neonMigrate(db, { migrationsFolder: './drizzle' })
} else {
  const client = postgres(databaseUrl, { max: 1 })
  const db = postgresDrizzle(client)
  await postgresMigrate(db, { migrationsFolder: './drizzle' })
  await client.end()
}

console.log('Migrations applied successfully.')
process.exit(0)
