'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { APP_CONFIG, UI_TEXT } from '@/config/constants'

type SidebarHeaderProps = {
  searchValue: string
  onSearchChange: (value: string) => void
}

export function SidebarHeader({ searchValue, onSearchChange }: SidebarHeaderProps) {
  const router = useRouter()

  const handleNewChat = useCallback(() => {
    router.push(ROUTES.CHAT)
  }, [router])

  return (
    <div className="border-b border-[--border-subtle] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-[--text-primary]">
          {APP_CONFIG.NAME}
        </span>
        <button
          type="button"
          onClick={handleNewChat}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary]"
          aria-label={UI_TEXT.NEW_CHAT_ARIA_LABEL}
        >
          <Plus size={16} />
        </button>
      </div>
      <input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={UI_TEXT.SIDEBAR_SEARCH_PLACEHOLDER}
        className="mt-2 w-full rounded-lg border border-[--border-default] bg-[--bg-input] px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-ghost] outline-none focus:border-[--accent]"
      />
    </div>
  )
}
