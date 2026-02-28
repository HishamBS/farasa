'use client'

import { useCallback, useEffect, useRef } from 'react'
import { trpcClient } from '@/trpc/client'
import { trpc } from '@/trpc/provider'
import { STREAM_EVENTS, STREAM_PHASES, STREAM_ACTIONS, MESSAGE_ROLES } from '@/config/constants'
import { useStreamState } from '@/features/stream-phases/hooks/use-stream-state'
import { AppError } from '@/lib/utils/errors'
import type { ChatInput, StreamChunk } from '@/schemas/message'
import type { v0_8 } from '@a2ui-sdk/types'

function isA2UIMessage(value: unknown): value is v0_8.A2UIMessage {
  if (value === null || typeof value !== 'object') return false
  if (!('type' in value)) return false
  return typeof value['type'] === 'string'
}

export function useChatStream() {
  const { state: streamState, dispatch, reset } = useStreamState()
  const abortRef = useRef<(() => void) | null>(null)
  const lastInputRef = useRef<ChatInput | null>(null)
  const utils = trpc.useUtils()

  useEffect(() => {
    return () => {
      abortRef.current?.()
      abortRef.current = null
    }
  }, [])

  const sendMessage = useCallback(
    (input: ChatInput) => {
      abortRef.current?.()
      lastInputRef.current = input
      dispatch({ type: STREAM_ACTIONS.SAVE_INPUT, input })
      reset()

      const convId = input.conversationId
      if (convId && !input.skipUserInsert) {
        utils.conversation.messages.setData({ conversationId: convId }, (old) => {
          if (!old) return old
          return [
            ...old,
            {
              id: crypto.randomUUID(),
              conversationId: convId,
              role: MESSAGE_ROLES.USER,
              content: input.content,
              metadata: null,
              tokenCount: null,
              createdAt: new Date(),
              attachments: [],
            },
          ]
        })
      }

      const subscription = trpcClient.chat.stream.subscribe(input, {
        onData(chunk: StreamChunk) {
          switch (chunk.type) {
            case STREAM_EVENTS.STATUS:
              dispatch({
                type: STREAM_ACTIONS.STATUS,
                phase: chunk.phase,
                message: chunk.message,
              })
              if (chunk.phase === STREAM_PHASES.GENERATING_TITLE) {
                void utils.conversation.list.invalidate()
                const cId = lastInputRef.current?.conversationId
                if (cId) void utils.conversation.getById.invalidate({ id: cId })
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
                // Non-fatal: malformed A2UI JSONL is skipped
              }
              break
            case STREAM_EVENTS.ERROR:
              dispatch({ type: STREAM_ACTIONS.ERROR, message: chunk.message })
              break
            case STREAM_EVENTS.DONE: {
              const doneConvId = lastInputRef.current?.conversationId
              if (doneConvId) {
                void utils.conversation.messages
                  .invalidate({ conversationId: doneConvId })
                  .then(() => {
                    dispatch({ type: STREAM_ACTIONS.DONE })
                    void utils.conversation.list.invalidate()
                  })
              } else {
                dispatch({ type: STREAM_ACTIONS.DONE })
              }
              break
            }
          }
        },
        onError(_err: Error) {
          abortRef.current?.()
          abortRef.current = null
          dispatch({ type: STREAM_ACTIONS.ERROR, message: AppError.CONNECTION })
        },
        onComplete() {
          abortRef.current = null
        },
      })

      abortRef.current = () => subscription.unsubscribe()
    },
    [dispatch, reset, utils],
  )

  const abort = useCallback(() => {
    abortRef.current?.()
    abortRef.current = null
  }, [])

  const retry = useCallback(() => {
    if (streamState.lastInput) {
      sendMessage(streamState.lastInput)
    }
  }, [streamState.lastInput, sendMessage])

  return { streamState, sendMessage, abort, retry }
}
