'use client'

import { useCallback } from 'react'
import Image from 'next/image'
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
    <div className="flex items-center gap-2 border-t border-(--border-subtle) px-3 py-2.5 shrink-0">
      {session?.user?.image ? (
        <Image
          src={session.user.image}
          alt={session.user.name ?? 'User avatar'}
          width={28}
          height={28}
          className="size-7 rounded-full object-cover shrink-0"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#6366f1] to-(--thinking) text-xs font-semibold text-white">
          {session?.user?.name?.[0]?.toUpperCase() ?? 'U'}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-normal text-(--text-secondary)">
          {session?.user?.name ?? 'User'}
        </p>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(white/5) hover:text-(--text-secondary)"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(white/5) hover:text-(--error)"
        aria-label="Sign out"
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}
