'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { UX } from '@/config/constants'

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  // Sidebar is always open on desktop (lg+). Framer Motion needs JS state to match.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    if (mq.matches) setIsOpen(true)
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setIsOpen(true)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  return { isOpen, open, close, toggle }
}
