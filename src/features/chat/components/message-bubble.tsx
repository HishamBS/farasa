'use client'

import { UserMessage } from './user-message'
import { HistoricalAssistantMessage } from './historical-assistant-message'
import type { MessageWithAttachments } from '@/schemas/conversation'

type MessageBubbleProps = {
  message: MessageWithAttachments
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return <UserMessage content={message.content} attachments={message.attachments} />
  }
  if (message.role === 'assistant') {
    return <HistoricalAssistantMessage message={message} />
  }
  return null
}
