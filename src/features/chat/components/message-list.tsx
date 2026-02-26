'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { fadeIn } from '@/lib/utils/motion'
import { UserMessage } from './user-message'
import { AssistantMessage } from './assistant-message'
import { EmptyState } from './empty-state'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { useAutoScroll } from '../hooks/use-auto-scroll'
import { CHAT_STREAM_STATUS } from '@/config/constants'
import type { StreamState } from '@/types/stream'
import type { Message } from '@/schemas/message'

type MessageListProps = {
  messages: Message[]
  streamState: StreamState
  isStreaming: boolean
  onSuggestionSelect?: (text: string) => void
}

export function MessageList({
  messages,
  streamState,
  isStreaming,
  onSuggestionSelect,
}: MessageListProps) {
  const shouldReduce = useReducedMotion()
  const { containerRef, bottomRef, isPaused, resume } = useAutoScroll(
    isStreaming,
  )

  const isEmpty =
    messages.length === 0 && streamState.phase === CHAT_STREAM_STATUS.IDLE

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {isEmpty ? (
        <EmptyState onSelect={onSuggestionSelect} />
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 lg:px-6">
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <UserMessage key={msg.id} content={msg.content} />
            ) : msg.role === 'assistant' ? (
              <motion.div
                key={msg.id}
                className="flex flex-col gap-3"
                {...(shouldReduce ? {} : fadeIn)}
              >
                <MarkdownRenderer content={msg.content} />
              </motion.div>
            ) : null,
          )}

          {isStreaming && streamState.phase !== CHAT_STREAM_STATUS.IDLE && (
            <AssistantMessage streamState={streamState} />
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {isPaused && isStreaming && (
        <motion.button
          type="button"
          onClick={resume}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[--border-default] bg-[--bg-surface] px-4 py-2 text-sm text-[--text-secondary] shadow-lg hover:bg-[--bg-surface-hover]"
          {...(shouldReduce ? {} : fadeIn)}
          aria-label="Scroll to latest message"
        >
          <ChevronDown size={14} />
          New messages
        </motion.button>
      )}
    </div>
  )
}
