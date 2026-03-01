'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { useChatStream } from '../hooks/use-chat-stream'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import type { ChatInputHandle } from './chat-input'
import { CHAT_STREAM_STATUS, UX } from '@/config/constants'
import type { TitlebarPhase } from '@/types/stream'
import { useStreamPhase } from '../context/stream-phase-context'
import { ConversationCostProvider } from '../context/conversation-cost-context'

type ChatContainerProps = {
  conversationId?: string
}

export function ChatContainer({ conversationId }: ChatContainerProps) {
  const { streamState, sendMessage, abort } = useChatStream()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const chatInputRef = useRef<ChatInputHandle>(null)
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
    { id: conversationId! },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER, enabled: !!conversationId },
  )

  const { data: messages = [] } = trpc.conversation.messages.useQuery(
    { conversationId: conversationId! },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER, enabled: !!conversationId },
  )

  const handleSuggestionSelect = useCallback((text: string) => {
    chatInputRef.current?.setContent(text)
  }, [])

  useEffect(() => {
    if (streamState.phase !== CHAT_STREAM_STATUS.ERROR) return
    if (!streamState.lastInput?.content) return
    chatInputRef.current?.setContent(streamState.lastInput.content)
  }, [streamState.phase, streamState.lastInput])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ConversationCostProvider messages={messages}>
        <MessageList
          messages={messages}
          streamState={streamState}
          isStreaming={isStreaming}
          onSuggestionSelect={handleSuggestionSelect}
        />
      </ConversationCostProvider>
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
