'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { UX } from '@/config/constants'

export function useAutoScroll(
  isActive: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
  scrollToBottom: () => void,
) {
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onScroll() {
      if (!container) return
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      if (distanceFromBottom > UX.AUTO_SCROLL_THRESHOLD) {
        setIsPaused(true)
      } else {
        setIsPaused(false)
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [containerRef])

  useEffect(() => {
    if (isActive && !isPaused) {
      scrollToBottom()
    }
  }, [isActive, isPaused, scrollToBottom])

  const resume = useCallback(() => {
    setIsPaused(false)
    scrollToBottom()
  }, [scrollToBottom])

  return { isPaused, resume }
}
