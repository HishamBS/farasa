'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { trpc } from '@/trpc/provider'
import { ROUTES } from '@/config/routes'

const CHAT_ID_PATTERN =
  /^\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/

type TitlebarProps = {
  onMenuClick: () => void
}

export function Titlebar({ onMenuClick }: TitlebarProps) {
  const pathname = usePathname()

  const conversationId = useMemo(() => {
    if (!pathname.startsWith(`${ROUTES.CHAT}/`)) return null
    const match = CHAT_ID_PATTERN.exec(pathname)
    return match?.[1] ?? null
  }, [pathname])

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: conversationId ?? '' },
    { enabled: !!conversationId, staleTime: Infinity },
  )

  const title = conversation?.title ?? null

  return (
    <header className="flex h-12 items-center gap-3 border-b border-[--border-subtle] px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary] lg:hidden"
        aria-label="Open sidebar"
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
