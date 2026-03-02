'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { UX } from '@/config/constants'

export function useSidebar() {
  const [isOpen, setIsOpenState] = useState(true)
  const touchStartX = useRef<number | null>(null)
  const prefsInitializedRef = useRef(false)

  const prefsQuery = trpc.userPreferences.get.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
  })
  const updatePrefsMutation = trpc.userPreferences.update.useMutation()

  // Initialize from DB preferences; seed DB on first load when no record exists
  useEffect(() => {
    if (prefsInitializedRef.current) return
    if (!prefsQuery.data) return
    prefsInitializedRef.current = true
    if ('userId' in prefsQuery.data) {
      // Real DB row exists — apply persisted value
      setIsOpenState(prefsQuery.data.sidebarExpanded)
    } else {
      // No DB row yet (server returned fallback defaults) — seed with current default
      updatePrefsMutation.mutate({ sidebarExpanded: isOpen })
    }
  }, [prefsQuery.data, isOpen, updatePrefsMutation])

  const setIsOpen = useCallback(
    (value: boolean) => {
      setIsOpenState(value)
      updatePrefsMutation.mutate({ sidebarExpanded: value })
    },
    [updatePrefsMutation],
  )

  const open = useCallback(() => setIsOpen(true), [setIsOpen])
  const close = useCallback(() => setIsOpen(false), [setIsOpen])
  const toggle = useCallback(() => setIsOpen(!isOpen), [setIsOpen, isOpen])

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      if (touch && touch.clientX < UX.SIDEBAR_SWIPE_OPEN_THRESHOLD) {
        touchStartX.current = touch.clientX
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (touchStartX.current === null) return
      const touch = e.changedTouches[0]
      if (touch && touch.clientX - touchStartX.current > UX.SIDEBAR_SWIPE_CLOSE_THRESHOLD) {
        setIsOpen(true)
      }
      touchStartX.current = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [setIsOpen])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  return { isOpen, open, close, toggle }
}
