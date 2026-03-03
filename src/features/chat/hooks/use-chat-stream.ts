'use client'

import {
  BROWSER_EVENTS,
  MESSAGE_ROLES,
  STATUS_MESSAGES,
  STREAM_ACTIONS,
  STREAM_EVENTS,
  STREAM_PHASES,
} from '@/config/constants'
import { ROUTES } from '@/config/routes'
import { useStreamState } from '@/features/stream-phases/hooks/use-stream-state'
import type { MessageWithAttachments } from '@/schemas/conversation'
import type { ChatInput, StreamChunk } from '@/schemas/message'
import { trpcClient } from '@/trpc/client'
import { trpc } from '@/trpc/provider'
import type { v0_8 } from '@a2ui-sdk/types'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

type ActiveStreamSession = {
  conversationId: string | undefined
  sessionId: string
  unsubscribe: () => void
  isSettled: boolean
}

function isA2UIMessage(value: unknown): value is v0_8.A2UIMessage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return (
    'beginRendering' in obj ||
    'surfaceUpdate' in obj ||
    'dataModelUpdate' in obj ||
    'deleteSurface' in obj
  )
}

export function useChatStream(conversationId?: string) {
  const router = useRouter()
  const { state: streamState, dispatch, reset } = useStreamState()
  const utils = trpc.useUtils()
  const cancelStreamMutation = trpc.chat.cancel.useMutation()
  const activeSessionRef = useRef<ActiveStreamSession | null>(null)
  const sendLockRef = useRef(false)
  const resolvedConversationIdRef = useRef<string | undefined>(undefined)
  const pendingRouteConversationIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    resolvedConversationIdRef.current = conversationId
    dispatch({
      type: STREAM_ACTIONS.SET_CONVERSATION_ID,
      conversationId: conversationId ?? null,
    })
  }, [conversationId, dispatch])

  const clearActiveSession = useCallback(() => {
    const active = activeSessionRef.current
    if (!active) return
    active.unsubscribe()
    activeSessionRef.current = null
    sendLockRef.current = false
  }, [])

  const runStreamAttempt = useCallback(
    (input: ChatInput) => {
      const clientRequestId = input.clientRequestId ?? crypto.randomUUID()
      const effectiveConversationId = input.conversationId ?? resolvedConversationIdRef.current
      resolvedConversationIdRef.current = effectiveConversationId

      const activeSession = activeSessionRef.current
      if (
        activeSession &&
        !activeSession.isSettled &&
        activeSession.conversationId === effectiveConversationId
      ) {
        clearActiveSession()
      }

      reset()
      dispatch({
        type: STREAM_ACTIONS.SAVE_INPUT,
        input: { ...input, conversationId: effectiveConversationId, clientRequestId },
      })
      if (!input.model) {
        dispatch({
          type: STREAM_ACTIONS.STATUS,
          phase: STREAM_PHASES.ROUTING,
          message: STATUS_MESSAGES.ROUTING,
        })
      }

      const sessionId = crypto.randomUUID()
      const session: ActiveStreamSession = {
        conversationId: effectiveConversationId,
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
        active.unsubscribe()
        activeSessionRef.current = null
        sendLockRef.current = false

        dispatch({
          type: STREAM_ACTIONS.ERROR,
          error: {
            message: chunk.message,
            code: chunk.code,
            reasonCode: chunk.reasonCode ?? 'provider_unavailable',
            recoverable: chunk.recoverable ?? false,
            attempt: chunk.attempt ?? 0,
          },
        })
        pendingRouteConversationIdRef.current = undefined
        const convId = resolvedConversationIdRef.current
        if (convId) void utils.conversation.messages.invalidate({ conversationId: convId })
      }

      const subscription = trpcClient.chat.stream.subscribe(
        { ...input, conversationId: effectiveConversationId, clientRequestId },
        {
          onData(chunk: StreamChunk) {
            const active = activeSessionRef.current
            if (!active || active.sessionId !== sessionId) return

            switch (chunk.type) {
              case STREAM_EVENTS.CONVERSATION_CREATED:
                resolvedConversationIdRef.current = chunk.conversationId
                if (active) active.conversationId = chunk.conversationId
                pendingRouteConversationIdRef.current = chunk.conversationId
                dispatch({
                  type: STREAM_ACTIONS.SET_CONVERSATION_ID,
                  conversationId: chunk.conversationId,
                })
                window.history.replaceState(
                  window.history.state,
                  '',
                  ROUTES.CHAT_BY_ID(chunk.conversationId),
                )
                break
              case STREAM_EVENTS.USER_MESSAGE_SAVED: {
                dispatch({ type: STREAM_ACTIONS.CLEAR_PENDING_USER_MESSAGE })
                const convId = resolvedConversationIdRef.current
                if (convId) {
                  const userMessage: MessageWithAttachments = {
                    id: chunk.messageId,
                    conversationId: convId,
                    role: MESSAGE_ROLES.USER,
                    content: input.content,
                    metadata: null,
                    clientRequestId,
                    streamSequenceMax: null,
                    tokenCount: null,
                    createdAt: new Date(),
                    attachments: [],
                  }
                  utils.conversation.messages.setData({ conversationId: convId }, (current) => {
                    const currentMessages = current?.messages ?? []
                    const hasExistingMessage = currentMessages.some(
                      (message) =>
                        message.id === chunk.messageId ||
                        (clientRequestId.length > 0 && message.clientRequestId === clientRequestId),
                    )
                    if (hasExistingMessage) {
                      return current ?? { messages: currentMessages, nextCursor: null }
                    }

                    return {
                      messages: [...currentMessages, userMessage],
                      nextCursor: current?.nextCursor ?? null,
                    }
                  })
                  void utils.conversation.messages.invalidate({ conversationId: convId })
                }
                break
              }
              case STREAM_EVENTS.STATUS:
                dispatch({
                  type: STREAM_ACTIONS.STATUS,
                  phase: chunk.phase,
                  message: chunk.message,
                })
                if (chunk.phase === STREAM_PHASES.GENERATING_TITLE) {
                  const convId = resolvedConversationIdRef.current
                  void utils.conversation.list.invalidate()
                  if (convId) void utils.conversation.getById.invalidate({ id: convId })
                }
                break
              case STREAM_EVENTS.MODEL_SELECTED:
                dispatch({
                  type: STREAM_ACTIONS.MODEL_SELECTED,
                  model: chunk.model,
                  reasoning: chunk.reasoning,
                  source: chunk.source,
                  category: chunk.category,
                  responseFormat: chunk.responseFormat,
                  confidence: chunk.confidence,
                  factors: chunk.factors,
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
              case STREAM_EVENTS.DONE: {
                if (active.isSettled) return
                active.isSettled = true
                activeSessionRef.current = null
                sendLockRef.current = false
                dispatch({ type: STREAM_ACTIONS.DONE })
                const convId = resolvedConversationIdRef.current
                if (convId) {
                  void utils.conversation.messages.invalidate({ conversationId: convId })
                  void utils.conversation.getById.invalidate({ id: convId })
                }
                void utils.conversation.list.invalidate()
                const pendingRouteId = pendingRouteConversationIdRef.current
                if (pendingRouteId) {
                  pendingRouteConversationIdRef.current = undefined
                  router.replace(ROUTES.CHAT_BY_ID(pendingRouteId))
                }
                break
              }
            }
          },
          onError(error: Error) {
            sendLockRef.current = false
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
            if (!active.isSettled) {
              active.isSettled = true
              dispatch({
                type: STREAM_ACTIONS.ERROR,
                error: {
                  message: 'Connection interrupted. Please try again.',
                  reasonCode: 'stream_closed_unexpectedly',
                  recoverable: true,
                  code: 'STREAM_INCOMPLETE',
                  attempt: 0,
                },
              })
            }
            activeSessionRef.current = null
            sendLockRef.current = false
          },
        },
      )

      session.unsubscribe = () => subscription.unsubscribe()
    },
    [clearActiveSession, dispatch, reset, router, utils],
  )

  const sendMessage = useCallback(
    (input: ChatInput) => {
      if (sendLockRef.current) {
        return
      }
      sendLockRef.current = true
      runStreamAttempt(input)
    },
    [runStreamAttempt],
  )

  const abort = useCallback(() => {
    const active = activeSessionRef.current
    if (!active) return

    active.unsubscribe()
    activeSessionRef.current = null
    sendLockRef.current = false
    dispatch({ type: STREAM_ACTIONS.CLEAR_PENDING_USER_MESSAGE })

    const conversationId = resolvedConversationIdRef.current
    if (conversationId) {
      void cancelStreamMutation.mutateAsync({ conversationId })
    }
  }, [cancelStreamMutation, dispatch])

  useEffect(() => {
    return () => {
      const active = activeSessionRef.current
      if (!active) return
      active.unsubscribe()
      activeSessionRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleNewChatRequested = () => {
      clearActiveSession()
      resolvedConversationIdRef.current = undefined
      sendLockRef.current = false
      dispatch({ type: STREAM_ACTIONS.RESET })
      dispatch({ type: STREAM_ACTIONS.CLEAR_PENDING_USER_MESSAGE })
    }
    window.addEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, handleNewChatRequested)
    return () => {
      window.removeEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, handleNewChatRequested)
    }
  }, [clearActiveSession, dispatch])

  return { streamState, sendMessage, abort }
}
