'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trpcClient } from '@/trpc/client'
import {
  GROUP_EVENTS,
  GROUP_STREAM_PHASES,
  STREAM_ACTIONS,
  STREAM_EVENTS,
  CHAT_STREAM_STATUS,
} from '@/config/constants'
import {
  streamStateReducer,
  initialStreamState,
} from '@/features/stream-phases/hooks/use-stream-state'
import type { StreamState } from '@/types/stream'
import type { GroupStreamInput, GroupOutputChunk } from '@/schemas/group'
import type { GroupStreamPhase } from '@/features/group/types'

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
  const [phase, setPhase] = useState<GroupStreamPhase>(GROUP_STREAM_PHASES.IDLE)
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
    setPhase(GROUP_STREAM_PHASES.IDLE)
  }, [])

  const applyChunkToModelState = useCallback(
    (prev: Map<string, StreamState>, chunk: GroupOutputChunk) => {
      if (chunk.type !== GROUP_EVENTS.MODEL_CHUNK) return prev

      const { modelId, chunk: streamChunk } = chunk
      const next = new Map(prev)
      const current = next.get(modelId) ?? { ...initialStreamState }

      switch (streamChunk.type) {
        case STREAM_EVENTS.STATUS:
          next.set(
            modelId,
            streamStateReducer(current, {
              type: STREAM_ACTIONS.STATUS,
              phase: streamChunk.phase,
              message: streamChunk.message,
            }),
          )
          break
        case STREAM_EVENTS.MODEL_SELECTED:
          next.set(
            modelId,
            streamStateReducer(current, {
              type: STREAM_ACTIONS.MODEL_SELECTED,
              model: streamChunk.model,
              reasoning: streamChunk.reasoning,
              source: streamChunk.source,
              category: streamChunk.category,
              confidence: streamChunk.confidence,
              factors: streamChunk.factors,
            }),
          )
          break
        case STREAM_EVENTS.THINKING:
          next.set(
            modelId,
            streamStateReducer(current, {
              type: STREAM_ACTIONS.THINKING_CHUNK,
              content: streamChunk.content,
              isComplete: streamChunk.isComplete,
            }),
          )
          break
        case STREAM_EVENTS.TOOL_START:
          next.set(
            modelId,
            streamStateReducer(current, {
              type: STREAM_ACTIONS.TOOL_START,
              name: streamChunk.toolName,
              input: streamChunk.input,
            }),
          )
          break
        case STREAM_EVENTS.TOOL_RESULT:
          next.set(
            modelId,
            streamStateReducer(current, {
              type: STREAM_ACTIONS.TOOL_RESULT,
              name: streamChunk.toolName,
              result: streamChunk.result,
            }),
          )
          break
        case STREAM_EVENTS.TEXT:
          next.set(
            modelId,
            streamStateReducer(current, {
              type: STREAM_ACTIONS.TEXT_CHUNK,
              content: streamChunk.content,
            }),
          )
          break
        case STREAM_EVENTS.ERROR:
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
          break
        case STREAM_EVENTS.DONE:
          next.set(modelId, streamStateReducer(current, { type: STREAM_ACTIONS.DONE }))
          break
      }

      return next
    },
    [],
  )

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
    setPhase(GROUP_STREAM_PHASES.ACTIVE)
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
          setModelStates((prev) => applyChunkToModelState(prev, chunk))
        } else if (chunk.type === GROUP_EVENTS.STREAM_EVENT) {
          const eventChunk = chunk.chunk

          if (eventChunk.type === STREAM_EVENTS.CONVERSATION_CREATED) {
            onConversationCreatedRef.current?.(eventChunk.conversationId)
          } else if (eventChunk.type === STREAM_EVENTS.ERROR) {
            setPhase(GROUP_STREAM_PHASES.ERROR)
            setError(eventChunk.message)
          }
        } else if (chunk.type === GROUP_EVENTS.DONE) {
          setGroupDone(true)
          setGroupId(chunk.groupId)
          setPhase(GROUP_STREAM_PHASES.DONE)
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
        setPhase(GROUP_STREAM_PHASES.ERROR)
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
  }, [enabled, inputKey, applyChunkToModelState])

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
