'use client'

import { useCallback } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/utils/use-theme'
import { ROUTES } from '@/config/routes'

export function UserMenu() {
  const { data: session } = useSession()
  const { theme, toggleTheme } = useTheme()

  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: ROUTES.HOME })
  }, [])

  return (
    <div className="flex items-center gap-2 border-t border-[--border-subtle] px-4 py-3">
      {session?.user?.image ? (
        <img
          src={session.user.image}
          alt={session.user.name ?? 'User avatar'}
          className="size-7 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex size-7 items-center justify-center rounded-full bg-[--accent-muted] text-xs font-medium text-[--accent]">
          {session?.user?.name?.[0]?.toUpperCase() ?? 'U'}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[--text-primary]">
          {session?.user?.name ?? 'User'}
        </p>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary]"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--error]"
        aria-label="Sign out"
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}
