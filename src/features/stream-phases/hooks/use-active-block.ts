import { EXPANDABLE_BLOCKS } from '@/config/constants'
import { useCallback, useState } from 'react'

export type ActiveBlock = (typeof EXPANDABLE_BLOCKS)[keyof typeof EXPANDABLE_BLOCKS] | null

export function useActiveBlock() {
  const [activeBlock, setActiveBlock] = useState<ActiveBlock>(null)

  const toggleRouting = useCallback(
    () =>
      setActiveBlock((prev) =>
        prev === EXPANDABLE_BLOCKS.ROUTING ? null : EXPANDABLE_BLOCKS.ROUTING,
      ),
    [],
  )

  const toggleThinking = useCallback(
    () =>
      setActiveBlock((prev) =>
        prev === EXPANDABLE_BLOCKS.THINKING ? null : EXPANDABLE_BLOCKS.THINKING,
      ),
    [],
  )

  return { activeBlock, toggleRouting, toggleThinking } as const
}
