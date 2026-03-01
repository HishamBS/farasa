'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, X } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { UI_TEXT } from '@/config/constants'

type SidebarHeaderProps = {
  isSearchOpen: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  onClose: () => void
  onSearchToggle: () => void
}

export function SidebarHeader({
  isSearchOpen,
  searchValue,
  onSearchChange,
  onClose,
  onSearchToggle,
}: SidebarHeaderProps) {
  const router = useRouter()

  const handleNewChat = useCallback(() => {
    router.push(ROUTES.CHAT)
  }, [router])

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-2 border-b border-(--border-subtle) px-3.5 pb-2.5 pt-4">
        <span className="flex-1 text-base font-semibold tracking-tight text-(--text-primary)">
          far<span className="text-accent">asa</span>
        </span>
        <button
          type="button"
          onClick={onSearchToggle}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(white/5) hover:text-(--text-secondary)"
          aria-label="Toggle search conversations"
        >
          <Search size={15} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(white/5) hover:text-(--text-secondary)"
          aria-label="Close sidebar"
        >
          <X size={15} />
        </button>
      </div>
      <div className="px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-xl border border-(--accent-glow) bg-(--accent-muted) px-3 py-2 text-sm font-medium text-accent transition-all duration-200 hover:bg-(--accent-glow)"
          aria-label={UI_TEXT.NEW_CHAT_ARIA_LABEL}
        >
          <Plus size={14} className="shrink-0" />
          New conversation
        </button>
        {isSearchOpen && (
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={UI_TEXT.SIDEBAR_SEARCH_PLACEHOLDER}
            className="mt-2 w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-ghost) outline-none focus:border-accent"
          />
        )}
      </div>
    </div>
  )
}
