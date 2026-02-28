import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '@/config/env'
import * as schema from './schema'
import * as relations from './relations'

// During build (SKIP_ENV_VALIDATION=1), use a syntactically valid placeholder so
// neon() can initialize without throwing. No actual connection is made at init time.
const dbUrl =
  process.env.SKIP_ENV_VALIDATION === '1'
    ? 'postgresql://build:build@localhost:5432/build'
    : env.DATABASE_URL

const sql = neon(dbUrl)

export const db = drizzle(sql, { schema: { ...schema, ...relations } })

export type DB = typeof db
