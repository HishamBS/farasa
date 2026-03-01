'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trpcClient } from '@/trpc/client'
import { GROUP_EVENTS, STREAM_ACTIONS, STREAM_EVENTS, CHAT_STREAM_STATUS } from '@/config/constants'
import {
  streamStateReducer,
  initialStreamState,
} from '@/features/stream-phases/hooks/use-stream-state'
import type { StreamState } from '@/types/stream'
import type { GroupStreamInput, GroupOutputChunk } from '@/schemas/group'

type GroupStreamPhase = 'idle' | 'active' | 'done' | 'error'

type UseGroupStreamReturn = {
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  phase: GroupStreamPhase
  groupId: string | undefined
  groupDone: boolean
  error: string | undefined
  abort: () => void
}

type UseGroupStreamOptions = {
  enabled: boolean
  input: GroupStreamInput | null
  onConversationCreated?: (conversationId: string) => void
}

type ActiveSubscription = {
  unsubscribe: () => void
  sessionId: string
}

export function useGroupStream({
  enabled,
  input,
  onConversationCreated,
}: UseGroupStreamOptions): UseGroupStreamReturn {
  const [modelStates, setModelStates] = useState<Map<string, StreamState>>(new Map())
  const [modelOrder, setModelOrder] = useState<string[]>([])
  const [phase, setPhase] = useState<GroupStreamPhase>('idle')
  const [groupId, setGroupId] = useState<string | undefined>(undefined)
  const [groupDone, setGroupDone] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const activeSubRef = useRef<ActiveSubscription | null>(null)
  const onConversationCreatedRef = useRef(onConversationCreated)
  onConversationCreatedRef.current = onConversationCreated

  const inputRef = useRef(input)
  useEffect(() => {
    inputRef.current = input
  }, [input])

  const inputKey = useMemo(
    () =>
      input
        ? JSON.stringify({
            c: input.conversationId,
            m: input.models,
            content: input.content,
          })
        : null,
    [input],
  )

  const abort = useCallback(() => {
    const active = activeSubRef.current
    if (!active) return
    active.unsubscribe()
    activeSubRef.current = null
    setPhase('idle')
  }, [])

  useEffect(() => {
    if (!enabled || !inputKey) return

    const currentInput = inputRef.current
    if (!currentInput) return

    const sessionId = crypto.randomUUID()

    const initialStates = new Map<string, StreamState>()
    const initialOrder: string[] = []
    for (const modelId of currentInput.models) {
      initialStates.set(modelId, initialStreamState)
      initialOrder.push(modelId)
    }
    setModelStates(new Map(initialStates))
    setModelOrder(initialOrder)
    setPhase('active')
    setGroupId(undefined)
    setGroupDone(false)
    setError(undefined)

    const newSub: ActiveSubscription = { sessionId, unsubscribe: () => {} }
    activeSubRef.current = newSub

    const subscription = trpcClient.group.stream.subscribe(currentInput, {
      onData(chunk: GroupOutputChunk) {
        const active = activeSubRef.current
        if (!active || active.sessionId !== sessionId) return

        if (chunk.type === GROUP_EVENTS.MODEL_CHUNK) {
          const { modelId, chunk: streamChunk } = chunk

          if (streamChunk.type === STREAM_EVENTS.TEXT) {
            setModelStates((prev) => {
              const next = new Map(prev)
              const current = next.get(modelId) ?? { ...initialStreamState }
              next.set(
                modelId,
                streamStateReducer(current, {
                  type: STREAM_ACTIONS.TEXT_CHUNK,
                  content: streamChunk.content,
                }),
              )
              return next
            })
          } else if (streamChunk.type === STREAM_EVENTS.ERROR) {
            setModelStates((prev) => {
              const next = new Map(prev)
              const current = next.get(modelId) ?? { ...initialStreamState }
              next.set(
                modelId,
                streamStateReducer(current, {
                  type: STREAM_ACTIONS.ERROR,
                  error: {
                    message: streamChunk.message,
                    code: streamChunk.code,
                    reasonCode: streamChunk.reasonCode,
                    recoverable: streamChunk.recoverable,
                  },
                }),
              )
              return next
            })
          } else if (streamChunk.type === STREAM_EVENTS.DONE) {
            setModelStates((prev) => {
              const next = new Map(prev)
              const current = next.get(modelId) ?? { ...initialStreamState }
              next.set(modelId, streamStateReducer(current, { type: STREAM_ACTIONS.DONE }))
              return next
            })
          }
        } else if (chunk.type === GROUP_EVENTS.STREAM_EVENT) {
          const eventChunk = chunk.chunk

          if (eventChunk.type === STREAM_EVENTS.CONVERSATION_CREATED) {
            onConversationCreatedRef.current?.(eventChunk.conversationId)
          } else if (eventChunk.type === STREAM_EVENTS.ERROR) {
            setPhase('error')
            setError(eventChunk.message)
          }
        } else if (chunk.type === GROUP_EVENTS.DONE) {
          setGroupDone(true)
          setGroupId(chunk.groupId)
          setPhase('done')
          setModelStates((prev) => {
            const next = new Map(prev)
            for (const [modelId, state] of next) {
              if (
                state.phase !== CHAT_STREAM_STATUS.ERROR &&
                state.phase !== CHAT_STREAM_STATUS.COMPLETE
              ) {
                next.set(modelId, streamStateReducer(state, { type: STREAM_ACTIONS.DONE }))
              }
            }
            return next
          })
        }
      },
      onError(err: Error) {
        const active = activeSubRef.current
        if (!active || active.sessionId !== sessionId) return
        setPhase('error')
        setError(err.message || 'Connection error.')
        activeSubRef.current = null
      },
      onComplete() {
        const active = activeSubRef.current
        if (!active || active.sessionId !== sessionId) return
        activeSubRef.current = null
      },
    })

    newSub.unsubscribe = () => subscription.unsubscribe()

    return () => {
      newSub.unsubscribe()
      if (activeSubRef.current?.sessionId === sessionId) {
        activeSubRef.current = null
      }
    }
  }, [enabled, inputKey])

  return {
    modelStates,
    modelOrder,
    phase,
    groupId,
    groupDone,
    error,
    abort,
  }
}
