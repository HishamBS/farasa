import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db/client'

export async function createContext() {
  const session = await auth()
  return { session, db }
}

export type Context = Awaited<ReturnType<typeof createContext>>
