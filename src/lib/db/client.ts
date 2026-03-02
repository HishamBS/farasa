import { neon } from '@neondatabase/serverless'
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http'
import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js'
import { type PgQueryResultHKT, type PgDatabase } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import { env } from '@/config/env'
import * as schema from './schema'
import * as relations from './relations'
import { isNeonUrl } from './utils'

const fullSchema = { ...schema, ...relations }

const dbUrl = process.env.DATABASE_URL ?? env.DATABASE_URL

if (!dbUrl) {
  throw new Error('DATABASE_URL is required')
}

function createDb(): PgDatabase<PgQueryResultHKT, typeof fullSchema> {
  if (isNeonUrl(dbUrl)) {
    return neonDrizzle(neon(dbUrl), { schema: fullSchema })
  }
  return postgresDrizzle(postgres(dbUrl), { schema: fullSchema })
}

export const db = createDb()
export type DB = typeof db
