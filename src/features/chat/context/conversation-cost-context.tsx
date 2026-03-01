'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { MESSAGE_ROLES } from '@/config/constants'
import { MessageMetadataSchema } from '@/schemas/message'
import type { MessageWithAttachments } from '@/schemas/conversation'

type ConversationCostValue = {
  totalCostUsd: number
  totalTokens: number
}

const ConversationCostContext = createContext<ConversationCostValue>({
  totalCostUsd: 0,
  totalTokens: 0,
})

export function ConversationCostProvider({
  messages,
  children,
}: {
  messages: MessageWithAttachments[]
  children: ReactNode
}) {
  const value = useMemo(() => {
    let totalCostUsd = 0
    let totalTokens = 0
    for (const m of messages) {
      if (m.role !== MESSAGE_ROLES.ASSISTANT) continue
      const parsed = MessageMetadataSchema.safeParse(m.metadata)
      if (!parsed.success) continue
      totalCostUsd += parsed.data.usage?.cost ?? 0
      totalTokens += parsed.data.usage?.totalTokens ?? 0
    }
    return { totalCostUsd, totalTokens }
  }, [messages])
  return (
    <ConversationCostContext.Provider value={value}>{children}</ConversationCostContext.Provider>
  )
}

export function useConversationCost() {
  return useContext(ConversationCostContext)
}
