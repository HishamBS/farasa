'use client'

import {
  CHAT_MODES,
  CHAT_STREAM_STATUS,
  TEAM_STREAM_PHASES,
  TITLEBAR_PHASE,
  UX,
} from '@/config/constants'
import { ROUTES } from '@/config/routes'
import { useTeamStream } from '@/features/team/hooks/use-team-stream'
import { useTeamSynthesis } from '@/features/team/hooks/use-team-synthesis'
import type { LiveTeamData, ModelMeta } from '@/features/team/types'
import type { TeamStreamInput } from '@/schemas/team'
import { trpc } from '@/trpc/provider'
import type { TitlebarPhase } from '@/types/stream'
import { AlertCircle } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChatMode } from '../context/chat-mode-context'
import { ConversationCostProvider } from '../context/conversation-cost-context'
import { useStreamPhase } from '../context/stream-phase-context'
import { useChatStream } from '../hooks/use-chat-stream'
import type { ChatInputHandle } from './chat-input'
import { ChatInput } from './chat-input'
import { MessageList } from './message-list'

type ChatContainerProps = {
  conversationId?: string
}

export function ChatContainer({ conversationId: conversationIdProp }: ChatContainerProps) {
  const router = useRouter()
  const params = useParams<{ id?: string[] }>()
  const conversationIdFromRoute = Array.isArray(params.id) ? params.id[0] : undefined
  const conversationId = conversationIdFromRoute ?? conversationIdProp
  const { streamState, sendMessage, abort } = useChatStream(conversationId)
  const effectiveConversationId = streamState.resolvedConversationId ?? conversationId
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const chatInputRef = useRef<ChatInputHandle>(null)
  const {
    setPhase,
    setModelSelection,
    setHasText,
    setStatusMessages,
    setHasThinking,
    setHasToolActivity,
  } = useStreamPhase()
  const { mode } = useChatMode()
  const utils = trpc.useUtils()

  const [teamStreamInput, setTeamStreamInput] = useState<TeamStreamInput | null>(null)
  const teamConversationIdRef = useRef<string | undefined>(conversationId)
  const synthesis = useTeamSynthesis()

  useEffect(() => {
    teamConversationIdRef.current = conversationId
  }, [conversationId])

  const handleTeamConversationCreated = useCallback(
    (createdId: string) => {
      teamConversationIdRef.current = createdId
      window.history.replaceState(window.history.state, '', ROUTES.CHAT_BY_ID(createdId))
      void utils.conversation.invalidate()
    },
    [utils],
  )

  const {
    modelStates,
    modelOrder,
    phase: teamPhase,
    teamId,
    teamDone,
    error: teamError,
    abort: abortTeam,
  } = useTeamStream({
    enabled: teamStreamInput !== null,
    input: teamStreamInput,
    onConversationCreated: handleTeamConversationCreated,
  })

  useEffect(() => {
    if (teamDone) {
      const convId = teamConversationIdRef.current
      if (convId) {
        router.replace(ROUTES.CHAT_BY_ID(convId))
        void utils.conversation.messages.invalidate({ conversationId: convId })
        void utils.conversation.getById.invalidate({ id: convId })
      }
    }
  }, [teamDone, router, utils])

  const handleTeamSubmit = useCallback((input: TeamStreamInput) => {
    setTeamStreamInput(input)
  }, [])

  const { data: modelList = [] } = trpc.model.list.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
    enabled: mode === CHAT_MODES.TEAM,
  })

  const activeTeamModels = useMemo((): ModelMeta[] => {
    if (!teamStreamInput) return []
    const modelMap = new Map(modelList.map((m) => [m.id, m]))
    return teamStreamInput.models.map((modelId) => {
      const reg = modelMap.get(modelId)
      return { id: modelId, name: reg?.name ?? modelId, provider: reg?.provider }
    })
  }, [teamStreamInput, modelList])

  const titlebarPhase = useMemo((): TitlebarPhase => {
    if (streamState.phase === CHAT_STREAM_STATUS.COMPLETE) return TITLEBAR_PHASE.DONE
    if (streamState.phase === CHAT_STREAM_STATUS.ACTIVE) {
      if (streamState.thinking !== null && !streamState.thinking.completedAt)
        return TITLEBAR_PHASE.THINKING
      return TITLEBAR_PHASE.STREAMING
    }
    return TITLEBAR_PHASE.IDLE
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
    setStatusMessages(streamState.statusMessages)
  }, [streamState.statusMessages, setStatusMessages])

  useEffect(() => {
    const isThinkingActive =
      streamState.thinking !== null && streamState.thinking.completedAt === undefined
    setHasThinking(isThinkingActive)
  }, [streamState.thinking, setHasThinking])

  useEffect(() => {
    setHasToolActivity(streamState.toolExecutions.length > 0)
  }, [streamState.toolExecutions.length, setHasToolActivity])

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: effectiveConversationId ?? '' },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER, enabled: !!effectiveConversationId },
  )

  const { data: messagesData } = trpc.conversation.messages.useQuery(
    { conversationId: effectiveConversationId ?? '' },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER, enabled: !!effectiveConversationId },
  )
  const messages = useMemo(() => messagesData?.messages ?? [], [messagesData])

  const messagesHaveTeam = useMemo(() => {
    if (!teamId) return false
    return messages.some((m) => m.metadata?.teamId === teamId)
  }, [messages, teamId])

  useEffect(() => {
    if (teamDone && messagesHaveTeam && teamStreamInput !== null) {
      setTeamStreamInput(null)
    }
  }, [teamDone, messagesHaveTeam, teamStreamInput])

  const handleSuggestionSelect = useCallback((text: string) => {
    chatInputRef.current?.setContent(text)
  }, [])

  useEffect(() => {
    if (streamState.phase !== CHAT_STREAM_STATUS.ERROR) return
    if (!streamState.lastInput?.content) return
    chatInputRef.current?.setContent(streamState.lastInput.content)
  }, [streamState.phase, streamState.lastInput])

  const liveTeam = useMemo((): LiveTeamData | null => {
    const hasPersistedTeamMessages =
      !!teamId &&
      messages.some(
        (message) => message.metadata?.teamId === teamId && !message.metadata?.isTeamSynthesis,
      )
    const shouldRenderLiveTeam =
      teamPhase === TEAM_STREAM_PHASES.ACTIVE ||
      (teamPhase === TEAM_STREAM_PHASES.DONE && !hasPersistedTeamMessages)
    if (!shouldRenderLiveTeam) return null
    return {
      modelStates,
      modelOrder,
      teamDone,
      teamId,
      conversationId: teamConversationIdRef.current ?? conversationId ?? '',
      synthesis,
      models: activeTeamModels,
    }
  }, [
    teamPhase,
    modelStates,
    modelOrder,
    teamDone,
    teamId,
    conversationId,
    synthesis,
    activeTeamModels,
    messages,
  ])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ConversationCostProvider messages={messages}>
        <MessageList
          messages={messages}
          streamState={streamState}
          isChatStreaming={isStreaming}
          pendingUserMessage={streamState.pendingUserMessage}
          onSuggestionSelect={handleSuggestionSelect}
          conversationId={effectiveConversationId}
          liveTeam={liveTeam}
        />
      </ConversationCostProvider>
      {streamState.phase === CHAT_STREAM_STATUS.ERROR && streamState.error && (
        <div className="mx-auto w-full max-w-240 px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-(--error)/20 bg-(--error)/5 px-3 py-2 text-sm text-(--error)">
            <AlertCircle className="size-4 shrink-0" />
            <span className="flex-1">{streamState.error.message}</span>
          </div>
        </div>
      )}
      {teamPhase === TEAM_STREAM_PHASES.ERROR && teamError && (
        <div className="mx-auto w-full max-w-240 px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-(--error)/20 bg-(--error)/5 px-3 py-2 text-sm text-(--error)">
            <AlertCircle className="size-4 shrink-0" />
            <span className="flex-1">{teamError}</span>
          </div>
        </div>
      )}
      <ChatInput
        ref={chatInputRef}
        onSend={sendMessage}
        onAbort={teamPhase === TEAM_STREAM_PHASES.ACTIVE ? abortTeam : abort}
        isStreaming={isStreaming || teamPhase === TEAM_STREAM_PHASES.ACTIVE}
        conversationId={effectiveConversationId}
        initialModel={conversation?.model ?? undefined}
        onTeamSubmit={handleTeamSubmit}
      />
    </div>
  )
}
