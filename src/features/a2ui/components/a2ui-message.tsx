'use client'

import { A2UIProvider, A2UIRenderer, standardCatalog } from '@a2ui-sdk/react/0.8'
import type { v0_8 } from '@a2ui-sdk/types'

type A2UIMessageProps = {
  messages: v0_8.A2UIMessage[]
}

export function A2UIMessage({ messages }: A2UIMessageProps) {
  if (messages.length === 0) return null

  return (
    <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-3">
      <A2UIProvider messages={messages} catalog={standardCatalog}>
        <A2UIRenderer />
      </A2UIProvider>
    </div>
  )
}
