'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { trpcClient } from '@/trpc/client'
import { GROUP_EVENTS } from '@/config/constants'
import type { GroupSynthesisOutputChunk } from '@/schemas/group'

type SynthesisParams = {
  groupId: string
  conversationId: string
  judgeModel: string
}

export type UseSynthesisReturn = {
  synthesisText: string
  isSynthesizing: boolean
  isDone: boolean
  error: string | undefined
  trigger: (params: SynthesisParams) => void
}

type ActiveSubscription = {
  unsubscribe: () => void
  sessionId: string
}

export function useGroupSynthesis(): UseSynthesisReturn {
  const [synthesisText, setSynthesisText] = useState('')
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const activeSubRef = useRef<ActiveSubscription | null>(null)

  const trigger = useCallback((params: SynthesisParams) => {
    const active = activeSubRef.current
    if (active) {
      active.unsubscribe()
      activeSubRef.current = null
    }

    setSynthesisText('')
    setIsDone(false)
    setError(undefined)
    setIsSynthesizing(true)

    const sessionId = crypto.randomUUID()

    const subscription = trpcClient.group.synthesize.subscribe(params, {
      onData(chunk: GroupSynthesisOutputChunk) {
        const currentSub = activeSubRef.current
        if (!currentSub || currentSub.sessionId !== sessionId) return

        if (chunk.type === GROUP_EVENTS.SYNTHESIS_CHUNK) {
          setSynthesisText((prev) => prev + chunk.content)
        } else if (chunk.type === GROUP_EVENTS.SYNTHESIS_DONE) {
          setIsDone(true)
          setIsSynthesizing(false)
        }
      },
      onError(err: Error) {
        const currentSub = activeSubRef.current
        if (!currentSub || currentSub.sessionId !== sessionId) return
        setError(err.message || 'Synthesis failed.')
        setIsSynthesizing(false)
        activeSubRef.current = null
      },
      onComplete() {
        const currentSub = activeSubRef.current
        if (!currentSub || currentSub.sessionId !== sessionId) return
        setIsSynthesizing(false)
        activeSubRef.current = null
      },
    })

    activeSubRef.current = {
      sessionId,
      unsubscribe: () => subscription.unsubscribe(),
    }
  }, [])

  useEffect(() => {
    return () => {
      const active = activeSubRef.current
      if (!active) return
      active.unsubscribe()
      activeSubRef.current = null
    }
  }, [])

  return {
    synthesisText,
    isSynthesizing,
    isDone,
    error,
    trigger,
  }
}
