'use client'

import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { fadeIn } from '@/lib/utils/motion'
import { MessageBubble } from './message-bubble'
import { AssistantMessage } from './assistant-message'
import { EmptyState } from './empty-state'
import { useAutoScroll } from '../hooks/use-auto-scroll'
import { CHAT_STREAM_STATUS, UI_TEXT } from '@/config/constants'
import type { StreamState } from '@/types/stream'
import type { MessageWithAttachments } from '@/schemas/conversation'

type MessageListProps = {
  messages: MessageWithAttachments[]
  streamState: StreamState
  isStreaming: boolean
  onSuggestionSelect?: (text: string) => void
}

// Tailwind gap-6 = 24px, py-6 = 24px top/bottom
const ITEM_GAP_PX = 24
const LIST_PADDING_PX = 24
const ESTIMATED_ITEM_HEIGHT_PX = 120

export function MessageList({
  messages,
  streamState,
  isStreaming,
  onSuggestionSelect,
}: MessageListProps) {
  const shouldReduce = useReducedMotion()
  const parentRef = useRef<HTMLDivElement>(null)

  const isEmpty = messages.length === 0 && streamState.phase === CHAT_STREAM_STATUS.IDLE

  const showStreaming = isStreaming && streamState.phase !== CHAT_STREAM_STATUS.IDLE

  // Total virtual items = historical messages + 1 streaming slot (when active)
  const itemCount = messages.length + (showStreaming ? 1 : 0)

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT_PX,
    overscan: 5,
    paddingStart: LIST_PADDING_PX,
    paddingEnd: LIST_PADDING_PX,
    gap: ITEM_GAP_PX,
  })

  const scrollToBottom = useCallback(() => {
    const container = parentRef.current
    if (!container) return
    container.scrollTo({
      top: container.scrollHeight,
      behavior: shouldReduce ? 'auto' : 'smooth',
    })
  }, [shouldReduce])

  const { isPaused, resume } = useAutoScroll(isStreaming, parentRef, scrollToBottom)

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      {isEmpty ? (
        <EmptyState onSelect={onSuggestionSelect} />
      ) : (
        <div
          className="relative mx-auto max-w-2xl px-4 lg:px-6"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const isStreamingSlot = virtualItem.index === messages.length
            const message = messages[virtualItem.index]

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {isStreamingSlot ? (
                  <AssistantMessage streamState={streamState} />
                ) : message !== undefined ? (
                  <MessageBubble message={message} />
                ) : null}
              </div>
            )
          })}
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
          {UI_TEXT.NEW_MESSAGES_LABEL}
        </motion.button>
      )}
    </div>
  )
}
