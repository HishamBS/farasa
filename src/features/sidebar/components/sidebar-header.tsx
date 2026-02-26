'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PenSquare } from 'lucide-react'
import { ROUTES } from '@/config/routes'

export function SidebarHeader() {
  const router = useRouter()

  const handleNewChat = useCallback(() => {
    router.push(ROUTES.CHAT)
  }, [router])

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[--border-subtle]">
      <span className="text-base font-semibold text-[--text-primary]">farasa</span>
      <button
        type="button"
        onClick={handleNewChat}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary]"
        aria-label="New chat"
      >
        <PenSquare size={16} />
      </button>
    </div>
  )
}
