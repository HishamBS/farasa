'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { trpc } from '@/trpc/provider'

export function useAutoScroll(
  isActive: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
  scrollToBottom: () => void,
) {
  const [isPaused, setIsPaused] = useState(false)
  const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const threshold = runtimeConfigQuery.data?.ux.autoScrollThreshold
    if (threshold === undefined) return
    const thresholdValue = threshold

    function onScroll() {
      if (!container) return
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      if (distanceFromBottom > thresholdValue) {
        setIsPaused(true)
      } else {
        setIsPaused(false)
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [containerRef, runtimeConfigQuery.data?.ux.autoScrollThreshold])

  useEffect(() => {
    if (!isActive || isPaused) return
    const container = containerRef.current
    if (!container) return

    const scroll = () => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
    }

    scroll()

    const observer = new MutationObserver(scroll)
    observer.observe(container, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [isActive, isPaused, containerRef])

  const prevActiveRef = useRef(isActive)

  useEffect(() => {
    if (prevActiveRef.current && !isActive && !isPaused) {
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
    prevActiveRef.current = isActive
  }, [isActive, isPaused, scrollToBottom])

  const resume = useCallback(() => {
    setIsPaused(false)
    scrollToBottom()
  }, [scrollToBottom])

  return { isPaused, resume }
}
