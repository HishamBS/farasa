'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { trpcClient } from '@/trpc/client'
import { GROUP_EVENTS, STREAM_EVENTS } from '@/config/constants'
import type { StreamState, StreamAction } from '@/types/stream'
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

const STREAM_ACTIONS_TEXT_CHUNK = 'TEXT_CHUNK' as const
const STREAM_ACTIONS_ERROR = 'ERROR' as const
const STREAM_ACTIONS_DONE = 'DONE' as const
const STREAM_ACTIONS_RESET = 'RESET' as const

function makeInitialStreamState(): StreamState {
  return {
    phase: 'idle',
    statusMessages: [],
    thinking: null,
    modelSelection: null,
    toolExecutions: [],
    textContent: '',
    a2uiMessages: [],
    error: null,
    lastInput: null,
    detectedSearchMode: false,
    pendingUserMessage: null,
  }
}

function streamStateReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case STREAM_ACTIONS_TEXT_CHUNK:
      return { ...state, phase: 'active', textContent: state.textContent + action.content }
    case STREAM_ACTIONS_ERROR:
      return { ...state, phase: 'error', error: action.error }
    case STREAM_ACTIONS_DONE:
      return { ...state, phase: 'complete' }
    case STREAM_ACTIONS_RESET:
      return makeInitialStreamState()
    default:
      return state
  }
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

  const abort = useCallback(() => {
    const active = activeSubRef.current
    if (!active) return
    active.unsubscribe()
    activeSubRef.current = null
    setPhase('idle')
  }, [])

  useEffect(() => {
    if (!enabled || !input) return

    const sessionId = crypto.randomUUID()

    const initialStates = new Map<string, StreamState>()
    const initialOrder: string[] = []
    for (const modelId of input.models) {
      initialStates.set(modelId, makeInitialStreamState())
      initialOrder.push(modelId)
    }
    setModelStates(new Map(initialStates))
    setModelOrder(initialOrder)
    setPhase('active')
    setGroupId(undefined)
    setGroupDone(false)
    setError(undefined)

    const subscription = trpcClient.group.stream.subscribe(input, {
      onData(chunk: GroupOutputChunk) {
        const active = activeSubRef.current
        if (!active || active.sessionId !== sessionId) return

        if (chunk.type === GROUP_EVENTS.MODEL_CHUNK) {
          const { modelId, chunk: streamChunk } = chunk

          if (streamChunk.type === STREAM_EVENTS.TEXT) {
            setModelStates((prev) => {
              const next = new Map(prev)
              const current = next.get(modelId) ?? makeInitialStreamState()
              next.set(
                modelId,
                streamStateReducer(current, {
                  type: STREAM_ACTIONS_TEXT_CHUNK,
                  content: streamChunk.content,
                }),
              )
              return next
            })
          } else if (streamChunk.type === STREAM_EVENTS.ERROR) {
            setModelStates((prev) => {
              const next = new Map(prev)
              const current = next.get(modelId) ?? makeInitialStreamState()
              next.set(
                modelId,
                streamStateReducer(current, {
                  type: STREAM_ACTIONS_ERROR,
                  error: {
                    message: streamChunk.message,
                    code: streamChunk.code,
                    reasonCode: streamChunk.reasonCode,
                    recoverable: streamChunk.recoverable,
                    attempt: streamChunk.attempt,
                  },
                }),
              )
              return next
            })
          } else if (streamChunk.type === STREAM_EVENTS.DONE) {
            setModelStates((prev) => {
              const next = new Map(prev)
              const current = next.get(modelId) ?? makeInitialStreamState()
              next.set(modelId, streamStateReducer(current, { type: STREAM_ACTIONS_DONE }))
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
              if (state.phase !== 'error' && state.phase !== 'complete') {
                next.set(modelId, streamStateReducer(state, { type: STREAM_ACTIONS_DONE }))
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

    const sub: ActiveSubscription = {
      sessionId,
      unsubscribe: () => subscription.unsubscribe(),
    }
    activeSubRef.current = sub

    return () => {
      sub.unsubscribe()
      if (activeSubRef.current?.sessionId === sessionId) {
        activeSubRef.current = null
      }
    }
  }, [enabled, input])

  useEffect(() => {
    return () => {
      const active = activeSubRef.current
      if (!active) return
      active.unsubscribe()
      activeSubRef.current = null
    }
  }, [])

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
