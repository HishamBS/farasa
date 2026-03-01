import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ROUTES } from '@/config/routes'
import { auth } from '@/lib/auth/config'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { ProtectedShell } from '@/features/layout/protected-shell'

type ProtectedLayoutProps = {
  children: ReactNode
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    redirect(ROUTES.LOGIN)
  }

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)

  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  return <ProtectedShell>{children}</ProtectedShell>
}
