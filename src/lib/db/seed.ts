import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http'
import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js'
import { type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import { MESSAGE_ROLES, MODEL_IDS } from '@/config/constants'
import { conversations, messages, users } from './schema'
import { isNeonUrl } from './utils'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to run seed. Check .env.example.')
}

let pgClient: ReturnType<typeof postgres> | null = null

const db: PgDatabase<PgQueryResultHKT> = (() => {
  if (isNeonUrl(databaseUrl)) {
    return neonDrizzle(neon(databaseUrl))
  }
  pgClient = postgres(databaseUrl, { max: 1 })
  return postgresDrizzle(pgClient)
})()

const devUserId = 'dev-user-00000000-0000-0000-0000-000000000001'

const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, devUserId))

if (existingUser) {
  console.log('Seed data already present. Skipping.')
  await pgClient?.end()
  process.exit(0)
}

await db.insert(users).values({
  id: devUserId,
  name: 'Dev User',
  email: 'dev@farasa.local',
  emailVerified: new Date(),
})

const [conv] = await db
  .insert(conversations)
  .values({
    userId: devUserId,
    title: 'Welcome to Farasa',
  })
  .returning({ id: conversations.id })

if (!conv) {
  throw new Error('Failed to create seed conversation.')
}

await db.insert(messages).values([
  {
    conversationId: conv.id,
    role: MESSAGE_ROLES.USER,
    content: 'What can you help me with?',
  },
  {
    conversationId: conv.id,
    role: MESSAGE_ROLES.ASSISTANT,
    content:
      "I'm Farasa — your intelligent AI assistant. I can help with coding, research, writing, data analysis, and more. I can also search the web, read files, and render interactive UIs directly in our conversation.",
    metadata: {
      modelUsed: MODEL_IDS.LLAMA_31_8B,
      routerReasoning: 'General greeting — fast model sufficient.',
    },
  },
])

console.log(`Seed complete. Dev user: ${devUserId}`)
await pgClient?.end()
process.exit(0)
