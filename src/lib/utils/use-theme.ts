'use client'

import { useState, useEffect, useCallback } from 'react'
import { APP_CONFIG } from '@/config/constants'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(APP_CONFIG.DEFAULT_THEME as Theme)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const isStoredTheme = stored === 'dark' || stored === 'light'
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const initial: Theme = isStoredTheme
      ? stored
      : media.matches
        ? 'dark'
        : 'light'
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)

    if (isStoredTheme) return

    const onMediaChange = (event: MediaQueryListEvent) => {
      const nextTheme: Theme = event.matches ? 'dark' : 'light'
      setTheme(nextTheme)
      document.documentElement.setAttribute('data-theme', nextTheme)
    }

    media.addEventListener('change', onMediaChange)
    return () => media.removeEventListener('change', onMediaChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
