import type { Session } from 'next-auth'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db/client'

function buildContext(session: Session | null) {
  return { session, db }
}

export type Context = ReturnType<typeof buildContext>

export function createContextFromSession(session: Session | null): Context {
  return buildContext(session)
}

export async function createContext(): Promise<Context> {
  const session = await auth()
  return buildContext(session)
}
