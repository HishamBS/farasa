'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'

const A2UIPolicyContext = createContext<RuntimeA2UIPolicy | null>(null)

export function A2UIPolicyProvider({
  policy,
  children,
}: {
  policy: RuntimeA2UIPolicy
  children: ReactNode
}) {
  return <A2UIPolicyContext.Provider value={policy}>{children}</A2UIPolicyContext.Provider>
}

export function useA2UIPolicy(): RuntimeA2UIPolicy | null {
  return useContext(A2UIPolicyContext)
}
