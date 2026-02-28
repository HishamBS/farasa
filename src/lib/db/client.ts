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

// During build (SKIP_ENV_VALIDATION=1), use a syntactically valid placeholder.
// No actual connection is made at init time.
const dbUrl =
  process.env.SKIP_ENV_VALIDATION === '1'
    ? 'postgresql://build:build@localhost:5432/build'
    : env.DATABASE_URL

function createDb(): PgDatabase<PgQueryResultHKT, typeof fullSchema> {
  if (isNeonUrl(dbUrl)) {
    return neonDrizzle(neon(dbUrl), { schema: fullSchema })
  }
  return postgresDrizzle(postgres(dbUrl), { schema: fullSchema })
}

export const db = createDb()
export type DB = typeof db
