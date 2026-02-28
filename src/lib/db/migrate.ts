import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to run migrations. Check .env.example.')
}

const sql = neon(databaseUrl)
const db = drizzle(sql)

await migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations applied successfully.')
process.exit(0)
