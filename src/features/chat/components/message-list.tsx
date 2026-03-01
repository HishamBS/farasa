'use client'

import { useRef, useCallback, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { fadeIn } from '@/lib/utils/motion'
import { MessageBubble } from './message-bubble'
import { AssistantMessage } from './assistant-message'
import { EmptyState } from './empty-state'
import { GroupMessageGroup } from '@/features/group/components/group-message-group'
import { useAutoScroll } from '../hooks/use-auto-scroll'
import { CHAT_STREAM_STATUS, MESSAGE_ROLES, MOTION, UI_TEXT } from '@/config/constants'
import { useConversationCost } from '../context/conversation-cost-context'
import { formatCost, formatTokenCount } from '@/lib/utils/format'
import type { StreamState } from '@/types/stream'
import type { MessageWithAttachments } from '@/schemas/conversation'
import type { UseSynthesisReturn } from '@/features/group/hooks/use-group-synthesis'
import type { ModelMeta } from '@/features/group/types'

type LiveGroupData = {
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  groupDone: boolean
  groupId: string | undefined
  conversationId: string
  synthesis: UseSynthesisReturn
  models: ModelMeta[]
}

type MessageListProps = {
  messages: MessageWithAttachments[]
  streamState: StreamState
  isStreaming: boolean
  pendingUserMessage?: string | null
  onSuggestionSelect?: (text: string) => void
  conversationId?: string
  liveGroup?: LiveGroupData | null
}

type RenderItem =
  | { type: 'single'; message: MessageWithAttachments }
  | { type: 'group'; messages: MessageWithAttachments[]; groupId: string }

export function MessageList({
  messages,
  streamState,
  isStreaming,
  pendingUserMessage,
  onSuggestionSelect,
  conversationId,
  liveGroup,
}: MessageListProps) {
  const shouldReduce = useReducedMotion()
  const parentRef = useRef<HTMLDivElement>(null)

  const isEmpty =
    messages.length === 0 &&
    streamState.phase === CHAT_STREAM_STATUS.IDLE &&
    !pendingUserMessage &&
    !liveGroup

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

  const renderItems = useMemo((): RenderItem[] => {
    const items: RenderItem[] = []
    let i = 0
    while (i < messages.length) {
      const msg = messages[i]
      if (!msg) {
        i++
        continue
      }
      const groupId = msg.metadata?.groupId
      if (msg.role === MESSAGE_ROLES.ASSISTANT && groupId && !msg.metadata?.isGroupSynthesis) {
        const groupMsgs: MessageWithAttachments[] = [msg]
        while (
          i + 1 < messages.length &&
          messages[i + 1]?.role === MESSAGE_ROLES.ASSISTANT &&
          messages[i + 1]?.metadata?.groupId === groupId &&
          !messages[i + 1]?.metadata?.isGroupSynthesis
        ) {
          i++
          const next = messages[i]
          if (next) groupMsgs.push(next)
        }
        items.push({ type: 'group', messages: groupMsgs, groupId })
      } else {
        items.push({ type: 'single', message: msg })
      }
      i++
    }
    return items
  }, [messages])

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

  const isAnyStreaming = isStreaming || (!!liveGroup && !liveGroup.groupDone)
  const { isPaused, resume } = useAutoScroll(isAnyStreaming, parentRef, scrollToBottom)
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
            {renderItems.map((item) => {
              if (item.type === 'group') {
                const historicalMessages = item.messages.map((msg) => ({
                  modelId: msg.metadata?.modelUsed ?? '',
                  content: msg.content,
                }))
                return (
                  <GroupMessageGroup
                    key={item.groupId}
                    mode="historical"
                    historicalMessages={historicalMessages}
                    conversationId={conversationId ?? ''}
                  />
                )
              }
              return <MessageBubble key={item.message.id} message={item.message} />
            })}
            {showPendingBubble && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-(--bg-surface-active) px-4 py-2.5 text-sm text-(--text-primary)">
                  {pendingUserMessage}
                </div>
              </div>
            )}
            {showStreaming && <AssistantMessage streamState={streamState} />}
            {liveGroup && (
              <GroupMessageGroup
                mode="live"
                modelStates={liveGroup.modelStates}
                modelOrder={liveGroup.modelOrder}
                groupDone={liveGroup.groupDone}
                groupId={liveGroup.groupId}
                conversationId={liveGroup.conversationId}
                synthesis={liveGroup.synthesis}
                models={liveGroup.models}
              />
            )}
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
        {isPaused && isAnyStreaming && (
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
