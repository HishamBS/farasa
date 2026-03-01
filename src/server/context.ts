import type { Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import { getToken } from 'next-auth/jwt'
import { env } from '@/config/env'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db/client'

export type Context = {
  session: Session | null
  db: typeof db
}

export function createContextFromSession(session: Session | null): Context {
  return { session, db }
}

function sessionFromToken(token: JWT): Session {
  const expires =
    typeof token.exp === 'number'
      ? new Date(token.exp * 1000).toISOString()
      : new Date(Date.now() + 60_000).toISOString()

  return {
    user: {
      id: token.sub ?? '',
      name: token.name ?? null,
      email: token.email ?? null,
      image: typeof token.picture === 'string' ? token.picture : null,
    },
    expires,
  }
}

export async function createContextFromRequest(req: Request): Promise<Context> {
  const token = await getToken({
    req,
    secret: env.AUTH_SECRET,
    secureCookie: env.NODE_ENV === 'production',
  })

  if (!token?.sub) {
    return { session: null, db }
  }

  return { session: sessionFromToken(token), db }
}

export async function createContext(): Promise<Context> {
  const session = await auth()
  return { session, db }
}
