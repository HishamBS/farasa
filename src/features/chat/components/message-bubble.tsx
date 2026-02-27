'use client'

import { UserMessage } from './user-message'
import { HistoricalAssistantMessage } from './historical-assistant-message'
import type { Message } from '@/schemas/message'

type MessageBubbleProps = {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return <UserMessage content={message.content} />
  }
  if (message.role === 'assistant') {
    return <HistoricalAssistantMessage message={message} />
  }
  return null
}
