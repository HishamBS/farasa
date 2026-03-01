'use client'

import { useRef, useCallback, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { fadeIn } from '@/lib/utils/motion'
import { MessageBubble } from './message-bubble'
import { AssistantMessage } from './assistant-message'
import { EmptyState } from './empty-state'
import { useAutoScroll } from '../hooks/use-auto-scroll'
import { CHAT_STREAM_STATUS, MESSAGE_ROLES, MOTION, UI_TEXT } from '@/config/constants'
import { useConversationCost } from '../context/conversation-cost-context'
import { formatCost, formatTokenCount } from '@/lib/utils/format'
import type { StreamState } from '@/types/stream'
import type { MessageWithAttachments } from '@/schemas/conversation'

type MessageListProps = {
  messages: MessageWithAttachments[]
  streamState: StreamState
  isStreaming: boolean
  pendingUserMessage?: string | null
  onSuggestionSelect?: (text: string) => void
}

export function MessageList({
  messages,
  streamState,
  isStreaming,
  pendingUserMessage,
  onSuggestionSelect,
}: MessageListProps) {
  const shouldReduce = useReducedMotion()
  const parentRef = useRef<HTMLDivElement>(null)

  const isEmpty =
    messages.length === 0 && streamState.phase === CHAT_STREAM_STATUS.IDLE && !pendingUserMessage

  const lastUserMessageContent =
    messages.length > 0 ? messages.findLast((m) => m.role === MESSAGE_ROLES.USER)?.content : null
  const showPendingBubble = !!pendingUserMessage && pendingUserMessage !== lastUserMessageContent

  const hasStreamedContent =
    !!streamState.textContent || !!streamState.thinking || streamState.toolExecutions.length > 0

  const lastMessageIsAssistant =
    messages.length > 0 && messages[messages.length - 1]?.role === MESSAGE_ROLES.ASSISTANT

  const showStreaming =
    (isStreaming && streamState.phase !== CHAT_STREAM_STATUS.IDLE) ||
    (streamState.phase === CHAT_STREAM_STATUS.COMPLETE &&
      hasStreamedContent &&
      !lastMessageIsAssistant)

  const dividerLabel = useMemo(() => {
    if (messages.length === 0) return null
    const latest = messages[messages.length - 1]
    if (!latest) return null
    const now = new Date()
    const sameDay = latest.createdAt.toDateString() === now.toDateString()
    return sameDay ? 'Today' : latest.createdAt.toLocaleDateString()
  }, [messages])

  const scrollToBottom = useCallback(() => {
    const container = parentRef.current
    if (!container) return
    container.scrollTo({
      top: container.scrollHeight,
      behavior: shouldReduce ? 'auto' : 'smooth',
    })
  }, [shouldReduce])

  const { isPaused, resume } = useAutoScroll(isStreaming, parentRef, scrollToBottom)
  const { totalCostUsd, totalTokens } = useConversationCost()

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto px-0 py-6">
      {isEmpty ? (
        <EmptyState onSelect={onSuggestionSelect} />
      ) : (
        <div className="mx-auto flex w-full max-w-170 flex-col px-5">
          {dividerLabel && (
            <div className="mb-8 flex items-center gap-4 text-xs font-medium text-(--text-muted)">
              <span className="h-px flex-1 bg-(--border-subtle)" />
              <span>{dividerLabel}</span>
              <span className="h-px flex-1 bg-(--border-subtle)" />
            </div>
          )}

          <div className="flex flex-col gap-9">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {showPendingBubble && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-(--bg-surface-active) px-4 py-2.5 text-sm text-(--text-primary)">
                  {pendingUserMessage}
                </div>
              </div>
            )}
            {showStreaming && <AssistantMessage streamState={streamState} />}
          </div>

          {totalCostUsd > 0 && (
            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-(--text-ghost)">
              <span>{formatTokenCount(totalTokens)} tokens</span>
              <span>·</span>
              <span>{formatCost(totalCostUsd)} total</span>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isPaused && isStreaming && (
          <motion.button
            type="button"
            onClick={resume}
            className="fixed bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-(--border-default) bg-(--bg-shell-strong) px-4 py-2 text-sm text-(--text-secondary) shadow-lg hover:bg-(--bg-surface-hover)"
            {...(shouldReduce ? {} : fadeIn)}
            exit={{ opacity: 0, y: 8, transition: { duration: MOTION.DURATION_FAST } }}
            aria-label="Scroll to latest message"
          >
            <ChevronDown size={14} />
            {UI_TEXT.NEW_MESSAGES_LABEL}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
