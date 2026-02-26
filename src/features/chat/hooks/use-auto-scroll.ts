'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { UX } from '@/config/constants'

export function useAutoScroll(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

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
  }, [])

  useEffect(() => {
    if (isActive && !isPaused) {
      scrollToBottom()
    }
  }, [isActive, isPaused, scrollToBottom])

  const resume = useCallback(() => {
    setIsPaused(false)
    scrollToBottom()
  }, [scrollToBottom])

  return { containerRef, bottomRef, isPaused, resume }
}
