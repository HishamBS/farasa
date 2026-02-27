'use client'

import { useCallback, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { useChatStream } from '../hooks/use-chat-stream'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { StreamProgress } from '@/features/stream-phases/components/stream-progress'
import type { ChatInputHandle } from './chat-input'
import { CHAT_STREAM_STATUS } from '@/config/constants'

type ChatContainerProps = {
  conversationId: string
}

export function ChatContainer({ conversationId }: ChatContainerProps) {
  const { streamState, sendMessage, abort } = useChatStream()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const chatInputRef = useRef<ChatInputHandle>(null)

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: conversationId },
    { staleTime: Infinity },
  )

  const { data: messages = [] } = trpc.conversation.messages.useQuery(
    { conversationId },
    { staleTime: Infinity },
  )

  const handleSuggestionSelect = useCallback((text: string) => {
    chatInputRef.current?.setContent(text)
  }, [])

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
