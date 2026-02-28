'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/features/chat/components/empty-state'
import { ChatInput } from '@/features/chat/components/chat-input'
import type { ChatInputHandle } from '@/features/chat/components/chat-input'
import { SESSION_KEYS } from '@/config/constants'
import { ROUTES } from '@/config/routes'
import type { ChatInput as ChatInputType } from '@/schemas/message'
import { trpc } from '@/trpc/provider'

export default function ChatPage() {
  const router = useRouter()
  const chatInputRef = useRef<ChatInputHandle>(null)
  const createConversation = trpc.conversation.create.useMutation()

  const handleSend = useCallback(
    (input: ChatInputType) => {
      void createConversation.mutateAsync({ model: input.model }).then((conversation) => {
        const payload: ChatInputType = {
          ...input,
          conversationId: conversation.id,
        }
        sessionStorage.setItem(
          `${SESSION_KEYS.PENDING_CHAT_INPUT_PREFIX}${conversation.id}`,
          JSON.stringify(payload),
        )
        router.push(ROUTES.CHAT_BY_ID(conversation.id))
      })
    },
    [createConversation, router],
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
        onAbort={() => {}}
        isStreaming={createConversation.isPending}
      />
    </div>
  )
}
