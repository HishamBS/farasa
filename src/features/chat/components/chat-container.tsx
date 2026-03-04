'use client'

import {
  CHAT_MODES,
  CHAT_STREAM_STATUS,
  MESSAGE_ROLES,
  TEAM_STREAM_PHASES,
  TITLEBAR_PHASE,
  UX,
} from '@/config/constants'
import { ROUTES } from '@/config/routes'
import { useTeamStream } from '@/features/team/hooks/use-team-stream'
import { useTeamSynthesis } from '@/features/team/hooks/use-team-synthesis'
import type { LiveTeamData, ModelMeta } from '@/features/team/types'
import { shouldRenderLiveTeam } from '@/features/team/utils/live-team-visibility'
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
  const { setPhase, setModelSelection, setHasText, setStatusMessages } = useStreamPhase()
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
    teamPersisted,
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
        if (conversationId !== convId) {
          router.replace(ROUTES.CHAT_BY_ID(convId))
        }
        void utils.conversation.messages.invalidate({ conversationId: convId })
        void utils.conversation.getById.invalidate({ id: convId })
      }
    }
  }, [teamDone, conversationId, router, utils])

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

  useEffect(() => {
    if (
      mode === CHAT_MODES.TEAM &&
      (teamPhase === TEAM_STREAM_PHASES.ACTIVE || teamPhase === TEAM_STREAM_PHASES.DONE)
    ) {
      const teamStates = [...modelStates.values()]
      const teamStatusMessages = teamStates.flatMap((state) => state.statusMessages)
      const hasTeamThinking = teamStates.some(
        (state) => state.thinking !== null && state.thinking.completedAt === undefined,
      )
      const hasTeamText = teamStates.some((state) => state.textContent.length > 0)
      const selectedFromTeam =
        teamStates.find((state) => state.modelSelection)?.modelSelection ?? null
      const nextPhase: TitlebarPhase =
        teamPhase === TEAM_STREAM_PHASES.DONE
          ? TITLEBAR_PHASE.DONE
          : hasTeamThinking
            ? TITLEBAR_PHASE.THINKING
            : hasTeamText
              ? TITLEBAR_PHASE.STREAMING
              : TITLEBAR_PHASE.IDLE

      setPhase(nextPhase)
      setModelSelection(selectedFromTeam)
      setHasText(hasTeamText)
      setStatusMessages(teamStatusMessages)
      return
    }

    const titlebarPhase: TitlebarPhase =
      streamState.phase === CHAT_STREAM_STATUS.COMPLETE
        ? TITLEBAR_PHASE.DONE
        : streamState.phase === CHAT_STREAM_STATUS.ACTIVE
          ? streamState.thinking !== null && !streamState.thinking.completedAt
            ? TITLEBAR_PHASE.THINKING
            : TITLEBAR_PHASE.STREAMING
          : TITLEBAR_PHASE.IDLE

    setPhase(titlebarPhase)
    setModelSelection(streamState.modelSelection)
    setHasText(streamState.textContent.length > 0)
    setStatusMessages(streamState.statusMessages)
  }, [
    mode,
    modelStates,
    setHasText,
    setModelSelection,
    setPhase,
    setStatusMessages,
    streamState.modelSelection,
    streamState.phase,
    streamState.statusMessages,
    streamState.textContent.length,
    streamState.thinking,
    teamPhase,
  ])

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: effectiveConversationId ?? '' },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER, enabled: !!effectiveConversationId },
  )

  const { data: messagesData, isLoading: isLoadingMessages } = trpc.conversation.messages.useQuery(
    { conversationId: effectiveConversationId ?? '' },
    { staleTime: UX.QUERY_STALE_TIME_FOREVER, enabled: !!effectiveConversationId },
  )
  const messages = useMemo(() => messagesData?.messages ?? [], [messagesData])
  const hasPersistedTeamMessages = useMemo(() => {
    if (!teamId) return false
    return messages.some(
      (message) => message.role === MESSAGE_ROLES.ASSISTANT && message.metadata?.teamId === teamId,
    )
  }, [messages, teamId])

  useEffect(() => {
    if (teamPersisted && teamStreamInput !== null && hasPersistedTeamMessages) {
      setTeamStreamInput(null)
    }
  }, [teamPersisted, teamStreamInput, hasPersistedTeamMessages])

  const handleSuggestionSelect = useCallback((text: string) => {
    chatInputRef.current?.setContent(text)
  }, [])

  useEffect(() => {
    if (streamState.phase !== CHAT_STREAM_STATUS.ERROR) return
    if (!streamState.lastInput?.content) return
    chatInputRef.current?.setContent(streamState.lastInput.content)
  }, [streamState.phase, streamState.lastInput])

  const liveTeam = useMemo((): LiveTeamData | null => {
    if (
      !shouldRenderLiveTeam({
        teamPhase,
        teamPersisted,
        hasPersistedTeamMessages,
      })
    ) {
      return null
    }
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
    teamPersisted,
    hasPersistedTeamMessages,
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
          isLoading={isLoadingMessages && !!effectiveConversationId}
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
