import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { MODEL_IDS } from '@/config/constants'
import { conversations, messages, users } from './schema'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to run seed. Check .env.example.')
}

const sql = neon(databaseUrl)
const db = drizzle(sql)

const devUserId = 'dev-user-00000000-0000-0000-0000-000000000001'

const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, devUserId))

if (existingUser) {
  console.log('Seed data already present. Skipping.')
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
    role: 'user',
    content: 'What can you help me with?',
  },
  {
    conversationId: conv.id,
    role: 'assistant',
    content:
      "I'm Farasa — your intelligent AI assistant. I can help with coding, research, writing, data analysis, and more. I can also search the web, read files, and render interactive UIs directly in our conversation.",
    metadata: {
      modelUsed: MODEL_IDS.CLAUDE_SONNET_4,
      routerReasoning: 'General greeting — fast model sufficient.',
    },
  },
])

console.log(`Seed complete. Dev user: ${devUserId}`)
process.exit(0)
