'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { trpc } from '@/trpc/provider'
import { useChatStream } from '../hooks/use-chat-stream'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import type { ChatInputHandle } from './chat-input'
import {
  CHAT_MODES,
  CHAT_STREAM_STATUS,
  GROUP_LIMITS,
  GROUP_STREAM_PHASES,
  UX,
} from '@/config/constants'
import { ROUTES } from '@/config/routes'
import type { TitlebarPhase } from '@/types/stream'
import { useStreamPhase } from '../context/stream-phase-context'
import { useChatMode } from '../context/chat-mode-context'
import { ConversationCostProvider } from '../context/conversation-cost-context'
import { useGroupStream } from '@/features/group/hooks/use-group-stream'
import { useGroupSynthesis } from '@/features/group/hooks/use-group-synthesis'
import type { GroupStreamInput } from '@/schemas/group'
import type { LiveGroupData, ModelMeta } from '@/features/group/types'

type ChatContainerProps = {
  conversationId?: string
}

export function ChatContainer({ conversationId: conversationIdProp }: ChatContainerProps) {
  const params = useParams()
  const router = useRouter()
  const conversationId = (params?.id as string | undefined) ?? conversationIdProp
  const { streamState, sendMessage, abort } = useChatStream()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const chatInputRef = useRef<ChatInputHandle>(null)
  const { setPhase, setModelSelection, setHasText } = useStreamPhase()
  const { mode, setMode } = useChatMode()
  const utils = trpc.useUtils()

  const [groupStreamInput, setGroupStreamInput] = useState<GroupStreamInput | null>(null)
  const [groupPendingUserMessage, setGroupPendingUserMessage] = useState<string | null>(null)
  const groupConversationIdRef = useRef<string | undefined>(conversationId)
  const synthesis = useGroupSynthesis()

  useEffect(() => {
    groupConversationIdRef.current = conversationId
  }, [conversationId])

  const handleGroupConversationCreated = useCallback(
    (createdId: string) => {
      groupConversationIdRef.current = createdId
      router.replace(ROUTES.CHAT_BY_ID(createdId))
      void utils.conversation.invalidate()
    },
    [router, utils],
  )

  const {
    modelStates,
    modelOrder,
    phase: groupPhase,
    groupId,
    groupDone,
    abort: abortGroup,
  } = useGroupStream({
    enabled: groupStreamInput !== null,
    input: groupStreamInput,
    onConversationCreated: handleGroupConversationCreated,
  })

  useEffect(() => {
    if (groupDone) {
      const convId = groupConversationIdRef.current
      if (convId) {
        void utils.conversation.messages.invalidate({ conversationId: convId })
        void utils.conversation.getById.invalidate({ id: convId })
      }
    }
  }, [groupDone, utils])

  const handleGroupSubmit = useCallback((input: GroupStreamInput) => {
    if (input.models.length < GROUP_LIMITS.MIN_MODELS) return
    setGroupPendingUserMessage(input.content)
    setGroupStreamInput(input)
  }, [])

  const { data: modelList = [] } = trpc.model.list.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
    enabled: mode === CHAT_MODES.GROUP,
  })

  const activeGroupModels = useMemo((): ModelMeta[] => {
    if (!groupStreamInput) return []
    return groupStreamInput.models.map((modelId) => {
      const reg = modelList.find((m) => m.id === modelId)
      return { id: modelId, name: reg?.name ?? modelId, provider: reg?.provider }
    })
  }, [groupStreamInput, modelList])

  const titlebarPhase = useMemo((): TitlebarPhase => {
    if (streamState.phase === CHAT_STREAM_STATUS.COMPLETE) return 'done'
    if (streamState.phase === CHAT_STREAM_STATUS.ACTIVE) {
      if (
        streamState.thinking !== null &&
        streamState.thinking !== undefined &&
        !streamState.thinking.completedAt
      )
        return 'thinking'
      return 'streaming'
    }
    return 'idle'
  }, [streamState.phase, streamState.thinking])

  useEffect(() => {
    setPhase(titlebarPhase)
  }, [titlebarPhase, setPhase])

  useEffect(() => {
    setModelSelection(streamState.modelSelection)
  }, [streamState.modelSelection, setModelSelection])

  useEffect(() => {
    setHasText(streamState.textContent.length > 0)
  }, [streamState.textContent, setHasText])

  useEffect(() => {
    if (streamState.detectedSearchMode) setMode(CHAT_MODES.SEARCH)
  }, [streamState.detectedSearchMode, setMode])

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: conversationId ?? '' },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER, enabled: !!conversationId },
  )

  const { data: messagesData } = trpc.conversation.messages.useQuery(
    { conversationId: conversationId ?? '' },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER, enabled: !!conversationId },
  )
  const messages = useMemo(() => messagesData?.messages ?? [], [messagesData?.messages])

  const messagesHaveGroup = useMemo(() => {
    if (!groupId) return false
    return messages.some((m) => m.metadata?.groupId === groupId)
  }, [messages, groupId])

  useEffect(() => {
    if (messagesHaveGroup && groupStreamInput !== null) {
      setGroupStreamInput(null)
      setGroupPendingUserMessage(null)
    }
  }, [messagesHaveGroup, groupStreamInput])

  const handleSuggestionSelect = useCallback((text: string) => {
    chatInputRef.current?.setContent(text)
  }, [])

  useEffect(() => {
    if (streamState.phase !== CHAT_STREAM_STATUS.ERROR) return
    if (!streamState.lastInput?.content) return
    chatInputRef.current?.setContent(streamState.lastInput.content)
  }, [streamState.phase, streamState.lastInput])

  const liveGroup = useMemo((): LiveGroupData | null => {
    const isGroupActive =
      (groupPhase === GROUP_STREAM_PHASES.ACTIVE || groupPhase === GROUP_STREAM_PHASES.DONE) &&
      !messagesHaveGroup
    if (!isGroupActive) return null
    return {
      modelStates,
      modelOrder,
      groupDone,
      groupId,
      conversationId: groupConversationIdRef.current ?? conversationId ?? '',
      synthesis,
      models: activeGroupModels,
    }
  }, [
    groupPhase,
    messagesHaveGroup,
    modelStates,
    modelOrder,
    groupDone,
    groupId,
    conversationId,
    synthesis,
    activeGroupModels,
  ])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ConversationCostProvider messages={messages}>
        <MessageList
          messages={messages}
          streamState={streamState}
          isChatStreaming={isStreaming}
          pendingUserMessage={streamState.pendingUserMessage ?? groupPendingUserMessage}
          onSuggestionSelect={handleSuggestionSelect}
          conversationId={conversationId}
          liveGroup={liveGroup}
        />
      </ConversationCostProvider>
      <ChatInput
        ref={chatInputRef}
        onSend={sendMessage}
        onAbort={groupPhase === GROUP_STREAM_PHASES.ACTIVE ? abortGroup : abort}
        isStreaming={isStreaming || groupPhase === GROUP_STREAM_PHASES.ACTIVE}
        conversationId={conversationId}
        initialModel={conversation?.model ?? undefined}
        onGroupSubmit={handleGroupSubmit}
      />
    </div>
  )
}
