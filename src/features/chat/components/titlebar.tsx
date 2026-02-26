'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import type { TitlebarProps } from '@/types/layout'

export function Titlebar({ onMenuClick }: Omit<TitlebarProps, 'title'>) {
  const pathname = usePathname()
  const isChat = pathname.startsWith('/chat/')
  const title = isChat ? 'New Conversation' : null

  return (
    <header className="flex h-12 items-center gap-3 border-b border-[--border-subtle] px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary] lg:hidden"
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
