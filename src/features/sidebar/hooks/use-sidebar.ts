'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { UX } from '@/config/constants'

export function useSidebar() {
  const [isOpen, setIsOpenState] = useState(true)
  const touchStartX = useRef<number | null>(null)

  const prefsQuery = trpc.userPreferences.get.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
  })
  const updatePrefsMutation = trpc.userPreferences.update.useMutation()

  useEffect(() => {
    if (!prefsQuery.data) return
    setIsOpenState(prefsQuery.data.sidebarExpanded)
  }, [prefsQuery.data])

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

  useEffect(() => {
    if (!isOpen) return

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    if (isDesktop) return

    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        setIsOpenState(false)
      }, UX.SIDEBAR_IDLE_AUTO_MINIMIZE_MS)
    }

    const pointerEvents: Array<keyof DocumentEventMap> = ['mousemove', 'touchstart', 'pointerdown']
    const keyboardEvents: Array<keyof DocumentEventMap> = ['keydown']

    schedule()
    for (const event of pointerEvents) {
      document.addEventListener(event, schedule, { passive: true })
    }
    for (const event of keyboardEvents) {
      document.addEventListener(event, schedule)
    }

    return () => {
      if (idleTimer) clearTimeout(idleTimer)
      for (const event of pointerEvents) {
        document.removeEventListener(event, schedule)
      }
      for (const event of keyboardEvents) {
        document.removeEventListener(event, schedule)
      }
    }
  }, [isOpen])

  return { isOpen, open, close, toggle }
}
