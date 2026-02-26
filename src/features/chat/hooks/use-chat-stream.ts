'use client'

import { useCallback, useRef } from 'react'
import { trpcClient } from '@/trpc/client'
import { STREAM_EVENTS } from '@/config/constants'
import { useStreamState } from '@/features/stream-phases/hooks/use-stream-state'
import type { ChatInput, StreamChunk } from '@/schemas/message'
import type { v0_8 } from '@a2ui-sdk/types'

export function useChatStream() {
  const { state: streamState, dispatch, reset } = useStreamState()
  const abortRef = useRef<(() => void) | null>(null)

  const sendMessage = useCallback(
    (input: ChatInput) => {
      abortRef.current?.()
      reset()

      const subscription = trpcClient.chat.stream.subscribe(input, {
        onData(chunk: StreamChunk) {
          switch (chunk.type) {
            case STREAM_EVENTS.STATUS:
              dispatch({
                type: 'STATUS',
                phase: chunk.phase,
                message: chunk.message,
              })
              break
            case STREAM_EVENTS.MODEL_SELECTED:
              dispatch({
                type: 'MODEL_SELECTED',
                model: chunk.model,
                reasoning: chunk.reasoning,
              })
              break
            case STREAM_EVENTS.THINKING:
              dispatch({
                type: 'THINKING_CHUNK',
                content: chunk.content,
                isComplete: chunk.isComplete,
              })
              break
            case STREAM_EVENTS.TOOL_START:
              dispatch({
                type: 'TOOL_START',
                name: chunk.toolName,
                input: chunk.input,
              })
              break
            case STREAM_EVENTS.TOOL_RESULT:
              dispatch({
                type: 'TOOL_RESULT',
                name: chunk.toolName,
                result: chunk.result,
              })
              break
            case STREAM_EVENTS.TEXT:
              dispatch({ type: 'TEXT_CHUNK', content: chunk.content })
              break
            case STREAM_EVENTS.A2UI:
              try {
                const message = JSON.parse(chunk.jsonl) as v0_8.A2UIMessage
                dispatch({ type: 'A2UI_MESSAGE', message })
              } catch {
                // Non-fatal: malformed A2UI JSONL is skipped
              }
              break
            case STREAM_EVENTS.ERROR:
              dispatch({ type: 'ERROR', message: chunk.message })
              break
            case STREAM_EVENTS.DONE:
              dispatch({ type: 'DONE' })
              break
          }
        },
        onError(err: Error) {
          dispatch({
            type: 'ERROR',
            message: err.message,
          })
        },
        onComplete() {
          abortRef.current = null
        },
      })

      abortRef.current = () => subscription.unsubscribe()
    },
    [dispatch, reset],
  )

  const abort = useCallback(() => {
    abortRef.current?.()
    abortRef.current = null
  }, [])

  return { streamState, sendMessage, abort }
}
