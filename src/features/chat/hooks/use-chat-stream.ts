'use client'

import { useCallback, useEffect, useRef } from 'react'
import { trpcClient } from '@/trpc/client'
import { trpc } from '@/trpc/provider'
import { STREAM_EVENTS, STREAM_PHASES, STREAM_ACTIONS } from '@/config/constants'
import { useStreamState } from '@/features/stream-phases/hooks/use-stream-state'
import type { ChatInput, StreamChunk } from '@/schemas/message'
import type { v0_8 } from '@a2ui-sdk/types'

type ActiveStreamSession = {
  conversationId: string
  sessionId: string
  unsubscribe: () => void
  isSettled: boolean
}

function isA2UIMessage(value: unknown): value is v0_8.A2UIMessage {
  if (value === null || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  if (typeof obj['type'] !== 'string') return false
  if (!('id' in obj) || typeof obj['id'] !== 'string') return false
  return true
}

export function useChatStream() {
  const { state: streamState, dispatch, reset } = useStreamState()
  const utils = trpc.useUtils()
  const cancelStreamMutation = trpc.chat.cancel.useMutation()
  const activeSessionRef = useRef<ActiveStreamSession | null>(null)

  const clearActiveSession = useCallback(() => {
    const active = activeSessionRef.current
    if (!active) return
    active.unsubscribe()
    activeSessionRef.current = null
  }, [])

  const runStreamAttempt = useCallback(
    (input: ChatInput) => {
      if (!input.conversationId) {
        dispatch({
          type: STREAM_ACTIONS.ERROR,
          error: {
            message: 'Conversation context is required before streaming.',
            reasonCode: 'validation_rejected',
            recoverable: false,
            attempt: 0,
          },
        })
        return
      }

      const activeConversationId = activeSessionRef.current?.conversationId
      if (activeConversationId && activeConversationId === input.conversationId) {
        clearActiveSession()
      }

      dispatch({ type: STREAM_ACTIONS.SAVE_INPUT, input })
      reset()

      const sessionId = crypto.randomUUID()
      const session: ActiveStreamSession = {
        conversationId: input.conversationId,
        sessionId,
        unsubscribe: () => {},
        isSettled: false,
      }
      activeSessionRef.current = session

      const settleWithError = (chunk: {
        message: string
        code?: string
        reasonCode?: string
        recoverable?: boolean
        attempt?: number
      }) => {
        const active = activeSessionRef.current
        if (!active || active.sessionId !== sessionId || active.isSettled) return
        active.isSettled = true

        dispatch({
          type: STREAM_ACTIONS.ERROR,
          error: {
            message: chunk.message,
            code: chunk.code,
            reasonCode: chunk.reasonCode ?? 'provider_unavailable',
            recoverable: false,
            attempt: 0,
          },
        })
        void utils.conversation.messages.invalidate({ conversationId: input.conversationId! })
      }

      const subscription = trpcClient.chat.stream.subscribe(input, {
        onData(chunk: StreamChunk) {
          const active = activeSessionRef.current
          if (!active || active.sessionId !== sessionId) return

          switch (chunk.type) {
            case STREAM_EVENTS.USER_MESSAGE_SAVED:
              void utils.conversation.messages.invalidate({
                conversationId: input.conversationId!,
              })
              break
            case STREAM_EVENTS.STATUS:
              dispatch({
                type: STREAM_ACTIONS.STATUS,
                phase: chunk.phase,
                message: chunk.message,
              })
              if (chunk.phase === STREAM_PHASES.GENERATING_TITLE) {
                void utils.conversation.list.invalidate()
                void utils.conversation.getById.invalidate({ id: input.conversationId! })
              }
              break
            case STREAM_EVENTS.MODEL_SELECTED:
              dispatch({
                type: STREAM_ACTIONS.MODEL_SELECTED,
                model: chunk.model,
                reasoning: chunk.reasoning,
              })
              break
            case STREAM_EVENTS.THINKING:
              dispatch({
                type: STREAM_ACTIONS.THINKING_CHUNK,
                content: chunk.content,
                isComplete: chunk.isComplete,
              })
              break
            case STREAM_EVENTS.TOOL_START:
              dispatch({
                type: STREAM_ACTIONS.TOOL_START,
                name: chunk.toolName,
                input: chunk.input,
              })
              break
            case STREAM_EVENTS.TOOL_RESULT:
              dispatch({
                type: STREAM_ACTIONS.TOOL_RESULT,
                name: chunk.toolName,
                result: chunk.result,
              })
              break
            case STREAM_EVENTS.TEXT:
              dispatch({ type: STREAM_ACTIONS.TEXT_CHUNK, content: chunk.content })
              break
            case STREAM_EVENTS.A2UI:
              try {
                const parsed: unknown = JSON.parse(chunk.jsonl)
                if (isA2UIMessage(parsed)) {
                  dispatch({ type: STREAM_ACTIONS.A2UI_MESSAGE, message: parsed })
                }
              } catch {
                // malformed A2UI lines are ignored without failing the stream
              }
              break
            case STREAM_EVENTS.ERROR:
              settleWithError({
                message: chunk.message,
                code: chunk.code,
                reasonCode: chunk.reasonCode,
                recoverable: chunk.recoverable,
                attempt: chunk.attempt,
              })
              break
            case STREAM_EVENTS.DONE:
              if (active.isSettled) return
              active.isSettled = true
              dispatch({ type: STREAM_ACTIONS.DONE })
              void utils.conversation.messages.invalidate({
                conversationId: input.conversationId!,
              })
              void utils.conversation.list.invalidate()
              void utils.conversation.getById.invalidate({ id: input.conversationId! })
              break
          }
        },
        onError(error: Error) {
          settleWithError({
            message: error.message || 'Connection error.',
            reasonCode: 'transient_network',
            recoverable: false,
            code: error.name,
            attempt: 0,
          })
        },
        onComplete() {
          const active = activeSessionRef.current
          if (!active || active.sessionId !== sessionId) return
          activeSessionRef.current = null
        },
      })

      session.unsubscribe = () => subscription.unsubscribe()
    },
    [clearActiveSession, dispatch, reset, utils],
  )

  const sendMessage = useCallback(
    (input: ChatInput) => {
      runStreamAttempt(input)
    },
    [runStreamAttempt],
  )

  const abort = useCallback(() => {
    const active = activeSessionRef.current
    if (!active) return

    active.unsubscribe()
    activeSessionRef.current = null

    void cancelStreamMutation.mutateAsync({
      conversationId: active.conversationId,
    })
  }, [cancelStreamMutation])

  useEffect(() => {
    return () => {
      const active = activeSessionRef.current
      if (!active) return
      active.unsubscribe()
      activeSessionRef.current = null
    }
  }, [])

  return { streamState, sendMessage, abort }
}
