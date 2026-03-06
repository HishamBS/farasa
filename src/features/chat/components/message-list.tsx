'use client'

import { CHAT_STREAM_STATUS, MESSAGE_ROLES, MOTION, UI_TEXT } from '@/config/constants'
import { TeamMessageGroup } from '@/features/team/components/team-message-group'
import type { LiveTeamData } from '@/features/team/types'
import { formatCost, formatTokenCount } from '@/lib/utils/format'
import { fadeIn } from '@/lib/utils/motion'
import type { MessageWithAttachments } from '@/schemas/conversation'
import type { StreamState } from '@/types/stream'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import { useConversationCost } from '../context/conversation-cost-context'
import { useAutoScroll } from '../hooks/use-auto-scroll'
import { AssistantMessage } from './assistant-message'
import { EmptyState } from './empty-state'
import { MessageBubble } from './message-bubble'

type MessageListProps = {
  messages: MessageWithAttachments[]
  streamState: StreamState
  isChatStreaming: boolean
  pendingUserMessage?: string | null
  onSuggestionSelect?: (text: string) => void
  conversationId?: string
  liveTeam?: LiveTeamData | null
  isLoading?: boolean
}

function MessageListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-9 px-4 py-6">
      <div className="flex justify-end">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-(--bg-surface-hover)" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-64 animate-pulse rounded bg-(--bg-surface-hover)" />
        <div className="h-4 w-80 animate-pulse rounded bg-(--bg-surface-hover)" />
        <div className="h-4 w-56 animate-pulse rounded bg-(--bg-surface-hover)" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-36 animate-pulse rounded-2xl bg-(--bg-surface-hover)" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-72 animate-pulse rounded bg-(--bg-surface-hover)" />
        <div className="h-4 w-60 animate-pulse rounded bg-(--bg-surface-hover)" />
      </div>
    </div>
  )
}

type RenderItem =
  | { type: 'single'; message: MessageWithAttachments }
  | {
      type: 'team'
      messages: MessageWithAttachments[]
      teamId: string
      synthesis?: MessageWithAttachments
    }

export function MessageList({
  messages,
  streamState,
  isChatStreaming,
  pendingUserMessage,
  onSuggestionSelect,
  conversationId,
  liveTeam,
  isLoading,
}: MessageListProps) {
  const shouldReduce = useReducedMotion()
  const parentRef = useRef<HTMLDivElement>(null)

  const isEmpty =
    messages.length === 0 &&
    streamState.phase === CHAT_STREAM_STATUS.IDLE &&
    !pendingUserMessage &&
    !liveTeam

  const showPendingBubble = useMemo(() => {
    if (!pendingUserMessage) return false
    const pendingRequestId = streamState.pendingClientRequestId
    if (!pendingRequestId) return true
    return !messages.some(
      (m) => m.role === MESSAGE_ROLES.USER && m.clientRequestId === pendingRequestId,
    )
  }, [pendingUserMessage, messages, streamState.pendingClientRequestId])

  const hasStreamedContent =
    !!streamState.textContent || !!streamState.thinking || streamState.toolExecutions.length > 0

  const lastMessageIsAssistant =
    messages.length > 0 && messages[messages.length - 1]?.role === MESSAGE_ROLES.ASSISTANT

  const showStreaming =
    (isChatStreaming && streamState.phase !== CHAT_STREAM_STATUS.IDLE) ||
    (streamState.phase === CHAT_STREAM_STATUS.COMPLETE &&
      hasStreamedContent &&
      !lastMessageIsAssistant)

  const renderItems = useMemo((): RenderItem[] => {
    const activeLiveTeamId = liveTeam?.teamId
    const teamMessages = new Map<
      string,
      {
        messages: MessageWithAttachments[]
        synthesis?: MessageWithAttachments
      }
    >()

    for (const message of messages) {
      const teamId = message.metadata?.teamId
      if (message.role !== MESSAGE_ROLES.ASSISTANT || !teamId) continue

      const current = teamMessages.get(teamId) ?? { messages: [] }
      if (message.metadata?.isTeamSynthesis) {
        current.synthesis = message
      } else {
        current.messages.push(message)
      }
      teamMessages.set(teamId, current)
    }

    const items: RenderItem[] = []
    const renderedTeamIds = new Set<string>()
    let i = 0
    while (i < messages.length) {
      const msg = messages[i]
      if (!msg) {
        i++
        continue
      }
      const teamId = msg.metadata?.teamId
      if (msg.role === MESSAGE_ROLES.ASSISTANT && teamId && !msg.metadata?.isTeamSynthesis) {
        if (activeLiveTeamId && teamId === activeLiveTeamId) {
          i++
          continue
        }
        if (!renderedTeamIds.has(teamId)) {
          renderedTeamIds.add(teamId)
          const grouped = teamMessages.get(teamId)
          if (grouped && grouped.messages.length > 0) {
            items.push({
              type: 'team',
              messages: grouped.messages,
              teamId,
              synthesis: grouped.synthesis,
            })
          } else {
            items.push({ type: 'single', message: msg })
          }
        }
      } else if (msg.role === MESSAGE_ROLES.ASSISTANT && teamId && msg.metadata?.isTeamSynthesis) {
        if (activeLiveTeamId && teamId === activeLiveTeamId) {
          i++
          continue
        }
        if (!renderedTeamIds.has(teamId)) {
          items.push({ type: 'single', message: msg })
        }
      } else {
        items.push({ type: 'single', message: msg })
      }
      i++
    }
    return items
  }, [liveTeam?.teamId, messages])

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

  const isAnyStreaming = isChatStreaming || (!!liveTeam && !liveTeam.teamDone)
  const { isPaused, resume } = useAutoScroll(isAnyStreaming, parentRef, scrollToBottom)
  const { totalCostUsd, totalTokens } = useConversationCost()

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto px-0 py-6">
      {isLoading ? (
        <MessageListSkeleton />
      ) : isEmpty ? (
        <EmptyState onSelect={onSuggestionSelect} />
      ) : (
        <div className="mx-auto flex w-full max-w-240 flex-col px-4">
          {dividerLabel && (
            <div className="mb-8 flex items-center gap-4 text-xs font-medium text-(--text-muted)">
              <span className="h-px flex-1 bg-(--border-subtle)" />
              <span>{dividerLabel}</span>
              <span className="h-px flex-1 bg-(--border-subtle)" />
            </div>
          )}

          <div className="flex flex-col gap-9">
            {renderItems.map((item) => {
              if (item.type === 'team') {
                const historicalMessages = item.messages.map((msg) => ({
                  modelId: msg.metadata?.modelUsed ?? '',
                  content: msg.content,
                  metadata: msg.metadata,
                }))
                return (
                  <TeamMessageGroup
                    key={item.teamId}
                    mode="historical"
                    historicalMessages={historicalMessages}
                    synthesisText={item.synthesis?.content}
                    synthesisModelId={item.synthesis?.metadata?.modelUsed}
                    teamId={item.teamId}
                    conversationId={conversationId ?? ''}
                  />
                )
              }
              return <MessageBubble key={item.message.id} message={item.message} />
            })}
            {showPendingBubble && (
              <div className="flex justify-end" aria-live="polite">
                <div className="max-w-[80%] rounded-2xl bg-(--bg-surface-active) px-4 py-2.5 text-sm text-(--text-primary)">
                  {pendingUserMessage}
                </div>
              </div>
            )}
            {showStreaming && <AssistantMessage streamState={streamState} />}
            {liveTeam && (
              <TeamMessageGroup
                mode="live"
                modelStates={liveTeam.modelStates}
                modelOrder={liveTeam.modelOrder}
                teamDone={liveTeam.teamDone}
                teamId={liveTeam.teamId}
                conversationId={liveTeam.conversationId}
                synthesis={liveTeam.synthesis}
                models={liveTeam.models}
                teamToolExecutions={liveTeam.teamToolExecutions}
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
