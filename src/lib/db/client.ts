import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '@/config/env'
import * as schema from './schema'
import * as relations from './relations'

const sql = neon(env.DATABASE_URL)

export const db = drizzle(sql, { schema: { ...schema, ...relations } })

export type DB = typeof db
