'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/features/chat/components/empty-state'
import { ChatInput } from '@/features/chat/components/chat-input'
import type { ChatInputHandle } from '@/features/chat/components/chat-input'
import { useChatStream } from '@/features/chat/hooks/use-chat-stream'
import { CHAT_STREAM_STATUS } from '@/config/constants'
import { ROUTES } from '@/config/routes'
import type { ChatInput as ChatInputType } from '@/schemas/message'

export default function ChatPage() {
  const router = useRouter()
  const { streamState, sendMessage, abort } = useChatStream()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const chatInputRef = useRef<ChatInputHandle>(null)

  const handleSend = useCallback(
    (input: ChatInputType) => {
      sendMessage(input)
      if (!input.conversationId) {
        router.push(ROUTES.CHAT)
      }
    },
    [sendMessage, router],
  )

  const handleSuggestionSelect = useCallback((text: string) => {
    chatInputRef.current?.setContent(text)
  }, [])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col">
        <EmptyState onSelect={handleSuggestionSelect} />
      </div>
      <ChatInput
        ref={chatInputRef}
        onSend={handleSend}
        onAbort={abort}
        isStreaming={isStreaming}
      />
    </div>
  )
}
