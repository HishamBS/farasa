'use client'

import {
  CHAT_MODES,
  CHAT_STREAM_STATUS,
  STREAM_ACTIONS,
  STREAM_EVENTS,
  TEAM_EVENTS,
  TEAM_STREAM_PHASES,
} from '@/config/constants'
import { AppError } from '@/lib/utils/errors'
import {
  initialStreamState,
  mapStreamChunkToAction,
  streamStateReducer,
} from '@/features/stream-phases/hooks/use-stream-state'
import { useStreamSession } from '@/features/chat/context/stream-session-context'
import type { TeamStreamPhase } from '@/features/team/types'
import type { TeamOutputChunk, TeamStreamInput } from '@/schemas/team'
import { trpcClient } from '@/trpc/client'
import type { StreamState } from '@/types/stream'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type UseTeamStreamReturn = {
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  phase: TeamStreamPhase
  teamId: string | undefined
  teamDone: boolean
  teamPersisted: boolean
  error: string | undefined
  abort: () => void
}

type UseTeamStreamOptions = {
  enabled: boolean
  input: TeamStreamInput | null
  onConversationCreated?: (conversationId: string) => void
}

type ActiveSubscription = {
  unsubscribe: () => void
  sessionId: string
}

export function useTeamStream({
  enabled,
  input,
  onConversationCreated,
}: UseTeamStreamOptions): UseTeamStreamReturn {
  const [modelStates, setModelStates] = useState<Map<string, StreamState>>(new Map())
  const [modelOrder, setModelOrder] = useState<string[]>([])
  const [phase, setPhase] = useState<TeamStreamPhase>(TEAM_STREAM_PHASES.IDLE)
  const [teamId, setTeamId] = useState<string | undefined>(undefined)
  const [teamDone, setTeamDone] = useState(false)
  const [teamPersisted, setTeamPersisted] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const { beginSession, endSession } = useStreamSession()

  const activeSubRef = useRef<ActiveSubscription | null>(null)
  const receivedTerminalEventRef = useRef(false)
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
            r: input.clientRequestId,
            m: input.models,
            content: input.content,
            s: input.webSearchEnabled,
            a: input.attachmentIds,
          })
        : null,
    [input],
  )

  const abort = useCallback(() => {
    const active = activeSubRef.current
    if (!active) return
    endSession(active.sessionId)
    active.unsubscribe()
    activeSubRef.current = null
    setPhase(TEAM_STREAM_PHASES.IDLE)
  }, [endSession])

  const applyChunkToModelState = useCallback(
    (prev: Map<string, StreamState>, chunk: TeamOutputChunk) => {
      if (chunk.type !== TEAM_EVENTS.MODEL_CHUNK) return prev

      const { modelId, chunk: streamChunk } = chunk
      const action = mapStreamChunkToAction(streamChunk)
      if (!action) return prev

      const next = new Map(prev)
      const current = next.get(modelId) ?? { ...initialStreamState }
      next.set(modelId, streamStateReducer(current, action))
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
    setPhase(TEAM_STREAM_PHASES.ACTIVE)
    setTeamId(undefined)
    setTeamDone(false)
    setTeamPersisted(false)
    setError(undefined)

    const newSub: ActiveSubscription = { sessionId, unsubscribe: () => {} }
    activeSubRef.current = newSub
    receivedTerminalEventRef.current = false
    beginSession(CHAT_MODES.TEAM, sessionId)

    const subscription = trpcClient.team.stream.subscribe(currentInput, {
      onData(chunk: TeamOutputChunk) {
        const active = activeSubRef.current
        if (!active || active.sessionId !== sessionId) return

        if (chunk.type === TEAM_EVENTS.MODEL_CHUNK) {
          setTeamId(chunk.teamId)
          setModelStates((prev) => applyChunkToModelState(prev, chunk))
        } else if (chunk.type === TEAM_EVENTS.STREAM_EVENT) {
          const eventChunk = chunk.chunk

          if (eventChunk.type === STREAM_EVENTS.CONVERSATION_CREATED) {
            onConversationCreatedRef.current?.(eventChunk.conversationId)
          } else if (eventChunk.type === STREAM_EVENTS.ERROR) {
            receivedTerminalEventRef.current = true
            setPhase(TEAM_STREAM_PHASES.ERROR)
            setError(eventChunk.message)
            activeSubRef.current = null
            endSession(sessionId)
          }
        } else if (chunk.type === TEAM_EVENTS.PERSISTED) {
          setTeamPersisted(true)
          setTeamId(chunk.teamId)
        } else if (chunk.type === TEAM_EVENTS.DONE) {
          receivedTerminalEventRef.current = true
          setTeamDone(true)
          setTeamId(chunk.teamId)
          setPhase(TEAM_STREAM_PHASES.DONE)
          activeSubRef.current = null
          endSession(sessionId)
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
        receivedTerminalEventRef.current = true
        setPhase(TEAM_STREAM_PHASES.ERROR)
        setError(err.message || AppError.CONNECTION_ERROR)
        activeSubRef.current = null
        endSession(sessionId)
      },
      onComplete() {
        const active = activeSubRef.current
        if (!active || active.sessionId !== sessionId) return
        if (!receivedTerminalEventRef.current) {
          setPhase(TEAM_STREAM_PHASES.ERROR)
          setError(AppError.CONNECTION_ERROR)
        }
        activeSubRef.current = null
        endSession(sessionId)
      },
    })

    newSub.unsubscribe = () => subscription.unsubscribe()

    return () => {
      newSub.unsubscribe()
      if (activeSubRef.current?.sessionId === sessionId) {
        activeSubRef.current = null
      }
      endSession(sessionId)
    }
  }, [applyChunkToModelState, beginSession, enabled, endSession, inputKey])

  return {
    modelStates,
    modelOrder,
    phase,
    teamId,
    teamDone,
    teamPersisted,
    error,
    abort,
  }
}
