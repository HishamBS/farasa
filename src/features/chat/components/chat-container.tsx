'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { useChatStream } from '../hooks/use-chat-stream'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import type { ChatInputHandle } from './chat-input'
import {
  CHAT_STREAM_STATUS,
  SESSION_KEYS,
  UX,
  CHAT_MODES,
  MESSAGE_ROLES,
  LIMITS,
} from '@/config/constants'
import { ChatInputSchema } from '@/schemas/message'
import type { TitlebarPhase } from '@/types/stream'
import { useStreamPhase } from '../context/stream-phase-context'

type ChatContainerProps = {
  conversationId: string
}

export function ChatContainer({ conversationId }: ChatContainerProps) {
  const { streamState, sendMessage, abort } = useChatStream()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const chatInputRef = useRef<ChatInputHandle>(null)
  const streamStartedRef = useRef(false)
  const restoredDraftRef = useRef<string | null>(null)
  const { setPhase } = useStreamPhase()

  const titlebarPhase = useMemo((): TitlebarPhase => {
    if (streamState.phase === CHAT_STREAM_STATUS.COMPLETE) return 'done'
    if (streamState.phase === CHAT_STREAM_STATUS.ACTIVE) {
      if (
        streamState.thinking !== null &&
        streamState.thinking !== undefined &&
        !streamState.thinking.completedAt
      )
        return 'thinking'
      return 'streaming'
    }
    return 'idle'
  }, [streamState.phase, streamState.thinking])

  useEffect(() => {
    setPhase(titlebarPhase)
  }, [titlebarPhase, setPhase])

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: conversationId },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER },
  )

  const { data: messages = [] } = trpc.conversation.messages.useQuery(
    { conversationId },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER },
  )

  const handleSuggestionSelect = useCallback((text: string) => {
    chatInputRef.current?.setContent(text)
  }, [])

  useEffect(() => {
    const storageKey = `${SESSION_KEYS.PENDING_CHAT_INPUT_PREFIX}${conversationId}`
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return
    streamStartedRef.current = true
    try {
      const parsed = ChatInputSchema.safeParse(JSON.parse(raw))
      if (parsed.success) sendMessage(parsed.data)
    } finally {
      sessionStorage.removeItem(storageKey)
    }
  }, [conversationId, sendMessage])

  useEffect(() => {
    if (streamStartedRef.current) return
    if (streamState.phase !== CHAT_STREAM_STATUS.IDLE) return
    if (messages.length === 0) return
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== MESSAGE_ROLES.USER) return
    const messageAgeMs = Date.now() - new Date(lastMessage.createdAt).getTime()
    if (messageAgeMs > LIMITS.RESTREAM_WINDOW_MS) return
    streamStartedRef.current = true
    const inferredRequestId = lastMessage.clientRequestId ?? crypto.randomUUID()
    sendMessage({
      conversationId,
      content: lastMessage.content,
      mode: CHAT_MODES.CHAT,
      model: undefined,
      attachmentIds: [],
      streamRequestId: inferredRequestId,
      attempt: 0,
      skipUserInsert: true,
    })
  }, [messages, streamState.phase, conversationId, sendMessage])

  useEffect(() => {
    if (streamState.phase !== CHAT_STREAM_STATUS.ERROR) return
    if (!streamState.lastInput?.content) return
    if (restoredDraftRef.current === streamState.lastInput.streamRequestId) return
    restoredDraftRef.current = streamState.lastInput.streamRequestId
    chatInputRef.current?.setContent(streamState.lastInput.content)
  }, [streamState.phase, streamState.lastInput])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList
        messages={messages}
        streamState={streamState}
        isStreaming={isStreaming}
        onSuggestionSelect={handleSuggestionSelect}
      />
      <ChatInput
        ref={chatInputRef}
        onSend={sendMessage}
        onAbort={abort}
        isStreaming={isStreaming}
        conversationId={conversationId}
        initialModel={conversation?.model ?? undefined}
      />
    </div>
  )
}
