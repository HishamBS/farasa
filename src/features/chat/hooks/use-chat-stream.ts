'use client'

import { useCallback, useEffect, useRef } from 'react'
import { trpcClient } from '@/trpc/client'
import { trpc } from '@/trpc/provider'
import { STREAM_EVENTS, STREAM_PHASES, STREAM_ACTIONS, MESSAGE_ROLES } from '@/config/constants'
import { useStreamState } from '@/features/stream-phases/hooks/use-stream-state'
import type { ChatInput, StreamChunk } from '@/schemas/message'
import type { v0_8 } from '@a2ui-sdk/types'

type ActiveStreamSession = {
  conversationId: string
  streamRequestId: string
  lastSequence: number
  attempt: number
  unsubscribe: () => void
  retryTimer: number | null
  isSettled: boolean
}

function isA2UIMessage(value: unknown): value is v0_8.A2UIMessage {
  if (value === null || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  if (typeof obj['type'] !== 'string') return false
  if (!('id' in obj) || typeof obj['id'] !== 'string') return false
  return true
}

function classifyRecoverableReason(reasonCode?: string): boolean {
  if (!reasonCode) return false
  return reasonCode === 'provider_unavailable' || reasonCode === 'transient_network'
}

function computeRetryDelay(
  attempt: number,
  config: {
    baseDelayMs: number
    maxDelayMs: number
    jitterMs: number
  },
): number {
  const exponential = Math.min(
    config.baseDelayMs * 2 ** Math.max(attempt - 1, 0),
    config.maxDelayMs,
  )
  const jitter = config.jitterMs > 0 ? Math.floor(Math.random() * config.jitterMs) : 0
  return Math.min(exponential + jitter, config.maxDelayMs)
}

export function useChatStream() {
  const { state: streamState, dispatch, reset } = useStreamState()
  const utils = trpc.useUtils()
  const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()
  const cancelStreamMutation = trpc.chat.cancel.useMutation()
  const activeSessionRef = useRef<ActiveStreamSession | null>(null)
  const pendingInputRef = useRef<ChatInput | null>(null)

  const clearActiveSession = useCallback(() => {
    const active = activeSessionRef.current
    if (!active) return
    if (active.retryTimer !== null) {
      window.clearTimeout(active.retryTimer)
    }
    active.unsubscribe()
    activeSessionRef.current = null
  }, [])

  const invalidateConversationViews = useCallback(
    (conversationId: string | undefined, invalidateOnDone: boolean, invalidateOnError: boolean) => {
      if (!conversationId) return
      if (invalidateOnDone) {
        void utils.conversation.messages.invalidate({ conversationId })
        void utils.conversation.list.invalidate()
        void utils.conversation.getById.invalidate({ id: conversationId })
      }
      if (invalidateOnError) {
        void utils.conversation.messages.invalidate({ conversationId })
      }
    },
    [utils],
  )

  const runStreamAttempt = useCallback(
    (input: ChatInput, isRetry: boolean) => {
      const runtimeConfig = runtimeConfigQuery.data
      if (!runtimeConfig) {
        pendingInputRef.current = input
        return
      }

      if (!input.conversationId) {
        dispatch({
          type: STREAM_ACTIONS.ERROR,
          error: {
            message: 'Conversation context is required before streaming.',
            reasonCode: 'validation_rejected',
            recoverable: false,
            attempt: input.attempt,
          },
        })
        return
      }

      const activeConversationId = activeSessionRef.current?.conversationId
      if (activeConversationId && activeConversationId === input.conversationId) {
        clearActiveSession()
      }

      if (!isRetry) {
        dispatch({ type: STREAM_ACTIONS.SAVE_INPUT, input })
        reset()

        if (!input.skipUserInsert) {
          utils.conversation.messages.setData({ conversationId: input.conversationId }, (old) => {
            if (!old) return old
            return [
              ...old,
              {
                id: crypto.randomUUID(),
                conversationId: input.conversationId!,
                role: MESSAGE_ROLES.USER,
                content: input.content,
                metadata: {
                  streamRequestId: input.streamRequestId,
                },
                clientRequestId: input.streamRequestId,
                streamSequenceMax: null,
                tokenCount: null,
                createdAt: new Date(),
                attachments: [],
              },
            ]
          })
        }
      }

      const session: ActiveStreamSession = {
        conversationId: input.conversationId,
        streamRequestId: input.streamRequestId,
        lastSequence: -1,
        attempt: input.attempt,
        unsubscribe: () => {},
        retryTimer: null,
        isSettled: false,
      }
      activeSessionRef.current = session
      pendingInputRef.current = null

      const settleWithError = (chunk: {
        message: string
        code?: string
        reasonCode?: string
        recoverable?: boolean
        attempt?: number
      }) => {
        const active = activeSessionRef.current
        if (!active || active.streamRequestId !== input.streamRequestId || active.isSettled) {
          return
        }
        active.isSettled = true

        const maxAttempts = runtimeConfig.chat.stream.retry.maxAttempts
        const nextAttempt = input.attempt + 1
        const recoverable = chunk.recoverable ?? classifyRecoverableReason(chunk.reasonCode)
        if (recoverable && nextAttempt <= maxAttempts) {
          const delayMs = computeRetryDelay(nextAttempt, runtimeConfig.chat.stream.retry)
          active.retryTimer = window.setTimeout(() => {
            runStreamAttempt(
              {
                ...input,
                attempt: nextAttempt,
                skipUserInsert: true,
              },
              true,
            )
          }, delayMs)
          return
        }

        dispatch({
          type: STREAM_ACTIONS.ERROR,
          error: {
            message: chunk.message,
            code: chunk.code,
            reasonCode:
              chunk.reasonCode ?? (recoverable ? 'transient_exhausted' : 'provider_unavailable'),
            recoverable: false,
            attempt: input.attempt,
          },
        })
        invalidateConversationViews(
          input.conversationId,
          false,
          runtimeConfig.chat.completion.invalidateOnError,
        )
      }

      const subscription = trpcClient.chat.stream.subscribe(input, {
        onData(chunk: StreamChunk) {
          const active = activeSessionRef.current
          if (!active || active.streamRequestId !== input.streamRequestId) return
          if (chunk.streamRequestId !== input.streamRequestId) return
          if (runtimeConfig.chat.stream.enforceSequence && typeof chunk.sequence === 'number') {
            if (chunk.sequence <= active.lastSequence) return
            active.lastSequence = chunk.sequence
          }

          switch (chunk.type) {
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
              void utils.conversation.list.invalidate()
              void utils.conversation.getById.invalidate({ id: input.conversationId! })
              if (runtimeConfig.chat.completion.invalidateOnDone) {
                void utils.conversation.messages.invalidate({
                  conversationId: input.conversationId!,
                })
              }
              break
          }
        },
        onError(error: Error) {
          settleWithError({
            message: runtimeConfig.chat.errors.connection,
            reasonCode: 'transient_network',
            recoverable: true,
            code: error.name,
            attempt: input.attempt,
          })
        },
        onComplete() {
          const active = activeSessionRef.current
          if (!active || active.streamRequestId !== input.streamRequestId) return
          if (active.retryTimer !== null) return
          activeSessionRef.current = null
        },
      })

      session.unsubscribe = () => subscription.unsubscribe()
    },
    [
      clearActiveSession,
      dispatch,
      invalidateConversationViews,
      reset,
      runtimeConfigQuery.data,
      utils,
    ],
  )

  const sendMessage = useCallback(
    (input: ChatInput) => {
      if (!input.skipUserInsert && input.conversationId) {
        utils.conversation.messages.setData({ conversationId: input.conversationId }, (old) => {
          if (!old) return old
          return [
            ...old,
            {
              id: crypto.randomUUID(),
              conversationId: input.conversationId!,
              role: MESSAGE_ROLES.USER,
              content: input.content,
              metadata: {
                streamRequestId: input.streamRequestId,
              },
              clientRequestId: input.streamRequestId,
              streamSequenceMax: null,
              tokenCount: null,
              createdAt: new Date(),
              attachments: [],
            },
          ]
        })
      }

      runStreamAttempt(
        {
          ...input,
          attempt: input.attempt ?? 0,
          skipUserInsert: true,
        },
        false,
      )
    },
    [runStreamAttempt, utils],
  )

  const abort = useCallback(() => {
    const active = activeSessionRef.current
    if (!active) return

    if (active.retryTimer !== null) {
      window.clearTimeout(active.retryTimer)
    }
    active.unsubscribe()
    activeSessionRef.current = null

    void cancelStreamMutation.mutateAsync({
      conversationId: active.conversationId,
      streamRequestId: active.streamRequestId,
    })
  }, [cancelStreamMutation])

  useEffect(() => {
    if (!runtimeConfigQuery.data) return
    const pending = pendingInputRef.current
    if (!pending) return
    if (activeSessionRef.current) return
    runStreamAttempt(pending, false)
  }, [runStreamAttempt, runtimeConfigQuery.data])

  useEffect(() => {
    return () => {
      const active = activeSessionRef.current
      if (!active) return
      if (active.retryTimer !== null) {
        window.clearTimeout(active.retryTimer)
      }
      active.unsubscribe()
      activeSessionRef.current = null
    }
  }, [])

  return { streamState, sendMessage, abort }
}
