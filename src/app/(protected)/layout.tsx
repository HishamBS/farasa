import type { ReactNode } from 'react'
import { ProtectedShell } from '@/features/layout/protected-shell'

type ProtectedLayoutProps = {
  children: ReactNode
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return <ProtectedShell>{children}</ProtectedShell>
}
