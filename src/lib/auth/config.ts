import NextAuth, { type DefaultSession } from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import type { Adapter, AdapterAccount } from '@auth/core/adapters'
import Google from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { env } from '@/config/env'
import { ROUTES } from '@/config/routes'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { encryptToken, decryptToken } from '@/lib/security/token-crypto'

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

function withEncryptedTokens(adapter: Adapter): Adapter {
  return {
    ...adapter,
    linkAccount: adapter.linkAccount
      ? async (account) => {
          await adapter.linkAccount!(await encryptAccountTokens(account))
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

const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  adapter: withEncryptedTokens(
    DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
  ),
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
  pages: {
    signIn: ROUTES.LOGIN,
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
