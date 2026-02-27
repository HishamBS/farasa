'use client'

import { useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { useChatStream } from '../hooks/use-chat-stream'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { StreamProgress } from '@/features/stream-phases/components/stream-progress'
import type { ChatInputHandle } from './chat-input'
import { CHAT_STREAM_STATUS, SESSION_KEYS, UX } from '@/config/constants'
import { ChatInputSchema } from '@/schemas/message'

type ChatContainerProps = {
  conversationId: string
}

export function ChatContainer({ conversationId }: ChatContainerProps) {
  const { streamState, sendMessage, abort } = useChatStream()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const chatInputRef = useRef<ChatInputHandle>(null)

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

    try {
      const parsed = ChatInputSchema.safeParse(JSON.parse(raw))
      if (parsed.success) {
        sendMessage(parsed.data)
      }
    } finally {
      sessionStorage.removeItem(storageKey)
    }
  }, [conversationId, sendMessage])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <StreamProgress streamState={streamState} />
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
        initialModel={conversation?.model}
      />
    </div>
  )
}
