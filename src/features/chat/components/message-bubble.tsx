'use client'

import { UserMessage } from './user-message'
import { HistoricalAssistantMessage } from './historical-assistant-message'
import type { MessageWithAttachments } from '@/schemas/conversation'
import { MESSAGE_ROLES } from '@/config/constants'

type MessageBubbleProps = {
  message: MessageWithAttachments
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === MESSAGE_ROLES.USER) {
    if (message.metadata?.isA2UIAction) return null
    return <UserMessage content={message.content} attachments={message.attachments} />
  }
  if (message.role === MESSAGE_ROLES.ASSISTANT) {
    return <HistoricalAssistantMessage message={message} />
  }
  return null
}
