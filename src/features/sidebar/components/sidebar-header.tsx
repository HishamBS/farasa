'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { APP_CONFIG, UI_TEXT } from '@/config/constants'

type SidebarHeaderProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  onClose: () => void
}

export function SidebarHeader({ searchValue, onSearchChange, onClose }: SidebarHeaderProps) {
  const router = useRouter()

  const handleNewChat = useCallback(() => {
    router.push(ROUTES.CHAT)
  }, [router])

  return (
    <div className="flex-shrink-0">
      <div className="flex items-center gap-2 border-b border-[--border-subtle] pt-4 px-3.5 pb-2.5">
        <span className="flex-1 text-sm font-semibold tracking-tight text-[--text-primary]">
          {APP_CONFIG.NAME}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary] lg:hidden"
          aria-label="Close sidebar"
        >
          <X size={15} />
        </button>
      </div>
      <div className="px-3 py-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-xl border border-[--accent-glow] bg-[--accent-muted] px-3 py-2 text-sm font-medium text-[--accent] transition-colors hover:bg-[--accent-glow]"
          aria-label={UI_TEXT.NEW_CHAT_ARIA_LABEL}
        >
          <Plus size={14} className="flex-shrink-0" />
          New conversation
        </button>
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={UI_TEXT.SIDEBAR_SEARCH_PLACEHOLDER}
          className="mt-2 w-full rounded-lg border border-[--border-default] bg-[--bg-input] px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-ghost] outline-none focus:border-[--accent]"
        />
      </div>
    </div>
  )
}
