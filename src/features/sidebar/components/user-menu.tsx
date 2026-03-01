'use client'

import { useCallback, useEffect } from 'react'
import Image from 'next/image'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { trpc } from '@/trpc/provider'
import { ROUTES } from '@/config/routes'
import { UI, UX } from '@/config/constants'

export function UserMenu() {
  const { data: session } = useSession()
  const { resolvedTheme, setTheme } = useTheme()
  const currentTheme = resolvedTheme ?? 'dark'
  const updatePrefsMutation = trpc.userPreferences.update.useMutation()
  const prefsQuery = trpc.userPreferences.get.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
  })

  // Sync DB theme to next-themes on initial load
  useEffect(() => {
    if (!prefsQuery.data) return
    const { theme } = prefsQuery.data
    if ((theme === 'dark' || theme === 'light') && theme !== resolvedTheme) {
      setTheme(theme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsQuery.data])

  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: ROUTES.HOME })
  }, [])

  return (
    <div className="flex items-center gap-2 border-t border-(--border-subtle) px-3 py-2.5 shrink-0">
      {session?.user?.image ? (
        <Image
          src={session.user.image}
          alt={session.user.name ?? 'User avatar'}
          width={UI.AVATAR_SIZE}
          height={UI.AVATAR_SIZE}
          className="size-7 rounded-full object-cover shrink-0"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-(--assistant-avatar-from) to-(--thinking) text-xs font-semibold text-white">
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
        onClick={() => {
          const next = currentTheme === 'dark' ? 'light' : 'dark'
          setTheme(next)
          updatePrefsMutation.mutate({ theme: next })
        }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(white/5) hover:text-(--text-secondary)"
        aria-label={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {currentTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
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
