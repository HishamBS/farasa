import { env } from '@/config/env'
import { authSharedConfig } from '@/lib/auth/shared-config'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { decryptToken, encryptToken } from '@/lib/security/token-crypto'
import type { Adapter, AdapterAccount } from '@auth/core/adapters'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import NextAuth, { type DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user']
  }
}

const ENCRYPTED_FIELDS = ['access_token', 'refresh_token', 'id_token'] as const

type TokenField = (typeof ENCRYPTED_FIELDS)[number]

async function encryptAccountTokens(account: AdapterAccount): Promise<AdapterAccount> {
  const result: AdapterAccount = { ...account }
  for (const field of ENCRYPTED_FIELDS) {
    const value = (result as Record<string, unknown>)[field]
    if (typeof value === 'string') {
      ;(result as Record<string, unknown>)[field] = await encryptToken(value, env.AUTH_SECRET)
    }
  }
  return result
}

async function tryDecryptField(value: string, field: TokenField): Promise<string> {
  try {
    return await decryptToken(value, env.AUTH_SECRET)
  } catch {
    console.error(`[auth] Failed to decrypt ${field}`)
    return value
  }
}

async function decryptAccountTokens(
  account: AdapterAccount | null,
): Promise<AdapterAccount | null> {
  if (!account) return null
  const result: AdapterAccount = { ...account }
  for (const field of ENCRYPTED_FIELDS) {
    const value = (result as Record<string, unknown>)[field]
    if (typeof value === 'string') {
      ;(result as Record<string, unknown>)[field] = await tryDecryptField(value, field)
    }
  }
  return result
}

async function cleanupOrphanUserAfterLinkFailure(userId: string): Promise<void> {
  const [existingAccount] = await db
    .select({ userId: schema.accounts.userId })
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId))
    .limit(1)

  if (existingAccount) {
    return
  }

  const [existingSession] = await db
    .select({ userId: schema.sessions.userId })
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, userId))
    .limit(1)

  if (existingSession) {
    return
  }

  const [existingConversation] = await db
    .select({ userId: schema.conversations.userId })
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, userId))
    .limit(1)

  if (existingConversation) {
    return
  }

  await db.delete(schema.users).where(eq(schema.users.id, userId))
}

function withEncryptedTokens(adapter: Adapter): Adapter {
  return {
    ...adapter,
    getUserByEmail: adapter.getUserByEmail
      ? async (email) => {
          const user = await adapter.getUserByEmail!(email)
          if (!user) return null

          const [linkedAccount] = await db
            .select({ userId: schema.accounts.userId })
            .from(schema.accounts)
            .where(eq(schema.accounts.userId, user.id))
            .limit(1)

          if (linkedAccount) {
            return user
          }

          // Repair orphaned OAuth state: user row exists without provider linkage.
          await db.delete(schema.users).where(eq(schema.users.id, user.id))
          return null
        }
      : undefined,
    linkAccount: adapter.linkAccount
      ? async (account) => {
          try {
            await adapter.linkAccount!(await encryptAccountTokens(account))
          } catch (error) {
            const userId = account.userId
            if (typeof userId === 'string' && userId.length > 0) {
              await cleanupOrphanUserAfterLinkFailure(userId)
            }
            throw error
          }
        }
      : undefined,
    getAccount: adapter.getAccount
      ? async (providerAccountId, provider) => {
          const account = await adapter.getAccount!(providerAccountId, provider)
          return await decryptAccountTokens(account)
        }
      : undefined,
  }
}

const authConfig = {
  ...authSharedConfig,
  adapter: withEncryptedTokens(
    DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
  ),
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
