'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { EmptyState } from '@/features/chat/components/empty-state'
import { ChatInput } from '@/features/chat/components/chat-input'
import type { ChatInputHandle } from '@/features/chat/components/chat-input'
import { ROUTES } from '@/config/routes'
import type { ChatInput as ChatInputType } from '@/schemas/message'
import { trpc } from '@/trpc/provider'
import { isTrpcUnauthorizedError } from '@/lib/utils/trpc-errors'

export default function ChatPage() {
  const router = useRouter()
  const chatInputRef = useRef<ChatInputHandle>(null)
  const createConversation = trpc.conversation.create.useMutation()

  const handleSend = useCallback(
    (input: ChatInputType) => {
      void createConversation
        .mutateAsync({
          model: input.model,
          firstMessage: input.content,
          streamRequestId: input.streamRequestId,
        })
        .then((conversation) => {
          router.push(ROUTES.CHAT_BY_ID(conversation.id))
        })
        .catch((error: unknown) => {
          if (isTrpcUnauthorizedError(error)) {
            void signOut({ callbackUrl: ROUTES.LOGIN })
          }
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
