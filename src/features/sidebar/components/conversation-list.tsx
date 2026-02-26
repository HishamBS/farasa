'use client'

import { usePathname } from 'next/navigation'
import { trpc } from '@/trpc/provider'
import { ConversationItem } from './conversation-item'
import { ROUTES } from '@/config/routes'
import { UX } from '@/config/constants'

export function ConversationList() {
  const pathname = usePathname()
  const { data: conversations, isLoading } = trpc.conversation.list.useQuery({})

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 px-2">
        {Array.from({ length: UX.SIDEBAR_SKELETON_COUNT }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="h-11 rounded-lg bg-[--bg-surface-hover] animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!conversations?.length) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-[--text-ghost]">No conversations yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          id={conv.id}
          title={conv.title}
          isPinned={conv.isPinned}
          isActive={pathname === ROUTES.CHAT_BY_ID(conv.id)}
          updatedAt={conv.updatedAt}
        />
      ))}
    </div>
  )
}
