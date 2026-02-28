'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trpc } from '@/trpc/provider'
import { ConversationItem } from './conversation-item'
import { ROUTES } from '@/config/routes'
import { LIMITS, UX } from '@/config/constants'

type ConversationListProps = {
  search: string
}

export function ConversationList({ search }: ConversationListProps) {
  const pathname = usePathname()
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.conversation.list.useInfiniteQuery(
      {
        search: search.trim() || undefined,
        limit: LIMITS.PAGINATION_DEFAULT_LIMIT,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: UX.QUERY_STALE_TIME_FOREVER,
      },
    )

  const conversations = data?.pages.flatMap((p) => p.items) ?? []

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, isFetchingNextPage])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 px-1.5">
        {Array.from({ length: UX.SIDEBAR_SKELETON_COUNT }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="h-11 animate-pulse rounded-lg bg-[--bg-surface-hover]"
          />
        ))}
      </div>
    )
  }

  if (!conversations.length) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-[--text-muted]">No conversations yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-1.5 pb-3">
      {!search.trim() && (
        <p className="px-3.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-[--text-muted]">
          Recent
        </p>
      )}
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

      <div ref={sentinelRef} className="h-1">
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <span className="size-4 animate-spin rounded-full border-2 border-[--border-default] border-t-[--accent]" />
          </div>
        )}
      </div>
    </div>
  )
}
