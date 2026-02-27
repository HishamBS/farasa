'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { trpc } from '@/trpc/provider'
import { ROUTES, PATTERNS } from '@/config/routes'
import { UX, UI_TEXT } from '@/config/constants'

type TitlebarProps = {
  onMenuClick: () => void
}

export function Titlebar({ onMenuClick }: TitlebarProps) {
  const pathname = usePathname()

  const conversationId = useMemo(() => {
    if (!pathname.startsWith(`${ROUTES.CHAT}/`)) return null
    const match = PATTERNS.CHAT_ID.exec(pathname)
    return match?.[1] ?? null
  }, [pathname])

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: conversationId ?? '' },
    { enabled: !!conversationId, staleTime: UX.QUERY_STALE_TIME_FOREVER },
  )

  const title = conversation?.title ?? null

  return (
    <header className="flex h-12 items-center gap-3 border-b border-[--border-subtle] px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary] lg:hidden"
        aria-label={UI_TEXT.OPEN_SIDEBAR_ARIA}
      >
        <Menu size={18} />
      </button>

      <div className="flex-1 truncate">
        {title && (
          <span className="text-sm font-medium text-[--text-primary]">
            {title}
          </span>
        )}
      </div>
    </header>
  )
}
