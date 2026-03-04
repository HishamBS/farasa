'use client'

import { A2UIProvider, A2UIRenderer } from '@a2ui-sdk/react/0.8'
import type { v0_8 } from '@a2ui-sdk/types'
import { customCatalog } from '../catalog/custom-catalog'
import { useA2UIActions } from '../hooks/use-a2ui-actions'
import { trpc } from '@/trpc/provider'
import { A2UIPolicyProvider } from '../context/policy-context'

type A2UIMessageProps = {
  messages: v0_8.A2UIMessage[]
}

export function A2UIMessage({ messages }: A2UIMessageProps) {
  const { handleAction } = useA2UIActions()
  const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()
  const policy = runtimeConfigQuery.data?.safety.a2ui

  if (!policy || messages.length === 0) return null

  return (
    <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-3">
      <A2UIPolicyProvider policy={policy}>
        <A2UIProvider messages={messages} catalog={customCatalog}>
          <A2UIRenderer onAction={handleAction} />
        </A2UIProvider>
      </A2UIPolicyProvider>
    </div>
  )
}
