'use client'

import {
  BROWSER_EVENTS,
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
import { ChatModeSchema } from '@/schemas/message'
import type { TeamStreamInput } from '@/schemas/team'
import { trpc } from '@/trpc/provider'
import type { TitlebarPhase } from '@/types/stream'
import { ErrorBanner } from '@/components/error-banner'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChatMode } from '../context/chat-mode-context'
import { ConversationCostProvider } from '../context/conversation-cost-context'
import { useStreamSession } from '../context/stream-session-context'
import { useStreamPhase } from '../context/stream-phase-context'
import { useChatStream } from '../hooks/use-chat-stream'
import type { ChatInputHandle } from './chat-input'
import { ChatInput } from './chat-input'
import { MessageList } from './message-list'

type PendingA2UIAction = {
  prompt: string
  webSearchEnabled: boolean
  isA2UIAction: boolean
}

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
  const isChatStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE
  const chatInputRef = useRef<ChatInputHandle>(null)
  const { setPhase, setModelSelection, setHasText, setStatusMessages } = useStreamPhase()
  const { mode, setActiveConversationId, isHydrated, hydrateFromConversation } = useChatMode()
  const { isTurnActive, activeEngine } = useStreamSession()
  const utils = trpc.useUtils()

  const [teamStreamInput, setTeamStreamInput] = useState<TeamStreamInput | null>(null)
  const teamConversationIdRef = useRef<string | undefined>(conversationId)
  const pendingA2UIRef = useRef<PendingA2UIAction | null>(null)
  const synthesis = useTeamSynthesis()

  useEffect(() => {
    teamConversationIdRef.current = conversationId
  }, [conversationId])

  useEffect(() => {
    setActiveConversationId(effectiveConversationId ?? undefined)
  }, [effectiveConversationId, setActiveConversationId])

  const handleTeamConversationCreated = useCallback(
    (createdId: string) => {
      teamConversationIdRef.current = createdId
      window.history.replaceState(window.history.state, '', ROUTES.CHAT_BY_ID(createdId))
      void utils.conversation.invalidate()
    },
    [utils],
  )

  const handleTeamTitleUpdated = useCallback(
    (title: string) => {
      const convId = teamConversationIdRef.current
      if (convId) {
        utils.conversation.getById.setData({ id: convId }, (prev) =>
          prev ? { ...prev, title } : prev,
        )
        void utils.conversation.list.invalidate()
      }
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
    teamToolExecutions,
    error: teamError,
    abort: abortTeam,
  } = useTeamStream({
    enabled: teamStreamInput !== null,
    input: teamStreamInput,
    conversationId,
    onConversationCreated: handleTeamConversationCreated,
    onTitleUpdated: handleTeamTitleUpdated,
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

  useEffect(() => {
    if (!effectiveConversationId || !conversation) return
    const parsed = ChatModeSchema.safeParse(conversation.mode)
    if (!parsed.success) return
    hydrateFromConversation({
      id: effectiveConversationId,
      mode: parsed.data,
      webSearchEnabled: conversation.webSearchEnabled,
      settingsVersion: conversation.settingsVersion ?? 0,
    })
  }, [effectiveConversationId, conversation, hydrateFromConversation])

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
    const handleNewChatRequested = () => {
      abortTeam()
      setTeamStreamInput(null)
    }
    window.addEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, handleNewChatRequested)
    return () => {
      window.removeEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, handleNewChatRequested)
    }
  }, [abortTeam])

  useEffect(() => {
    const onA2UIActionRequested = (event: Event) => {
      const custom = event as CustomEvent<{
        prompt?: string
        webSearchEnabled?: boolean
        isA2UIAction?: boolean
      }>
      const prompt = custom.detail?.prompt?.trim()
      if (!prompt) return
      const webSearchEnabled = Boolean(custom.detail?.webSearchEnabled)
      const isA2UIAction = Boolean(custom.detail?.isA2UIAction)
      if (isTurnActive) {
        pendingA2UIRef.current = { prompt, webSearchEnabled, isA2UIAction }
        return
      }
      sendMessage({
        content: prompt,
        mode: CHAT_MODES.CHAT,
        model: null,
        conversationId: effectiveConversationId,
        attachmentIds: [],
        webSearchEnabled,
        clientRequestId: crypto.randomUUID(),
        isA2UIAction,
      })
    }

    window.addEventListener(
      BROWSER_EVENTS.A2UI_ACTION_REQUESTED,
      onA2UIActionRequested as EventListener,
    )
    return () => {
      window.removeEventListener(
        BROWSER_EVENTS.A2UI_ACTION_REQUESTED,
        onA2UIActionRequested as EventListener,
      )
    }
  }, [effectiveConversationId, isTurnActive, sendMessage])

  useEffect(() => {
    if (isTurnActive) return
    const pending = pendingA2UIRef.current
    if (!pending) return
    pendingA2UIRef.current = null
    sendMessage({
      content: pending.prompt,
      mode: CHAT_MODES.CHAT,
      model: null,
      conversationId: effectiveConversationId,
      attachmentIds: [],
      webSearchEnabled: pending.webSearchEnabled,
      clientRequestId: crypto.randomUUID(),
      isA2UIAction: pending.isA2UIAction,
    })
  }, [isTurnActive, effectiveConversationId, sendMessage])

  useEffect(() => {
    if (streamState.phase !== CHAT_STREAM_STATUS.ERROR) return
    if (!streamState.lastInput?.content) return
    chatInputRef.current?.setContent(streamState.lastInput.content)
  }, [streamState.phase, streamState.lastInput])

  const canRetryLastTurn =
    !isTurnActive &&
    streamState.phase === CHAT_STREAM_STATUS.ERROR &&
    !!streamState.error?.recoverable &&
    !!streamState.lastInput

  const handleRetryLastTurn = useCallback(() => {
    if (!streamState.lastInput || isTurnActive) return
    sendMessage(streamState.lastInput)
  }, [isTurnActive, sendMessage, streamState.lastInput])

  const guardedSendMessage = useCallback(
    (input: Parameters<typeof sendMessage>[0]) => {
      if (!isHydrated && effectiveConversationId) return
      sendMessage(input)
    },
    [isHydrated, effectiveConversationId, sendMessage],
  )

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
      teamToolExecutions,
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
    teamToolExecutions,
    teamPersisted,
    hasPersistedTeamMessages,
  ])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ConversationCostProvider messages={messages}>
        <MessageList
          messages={messages}
          streamState={streamState}
          isChatStreaming={isChatStreaming}
          pendingUserMessage={streamState.pendingUserMessage}
          onSuggestionSelect={handleSuggestionSelect}
          conversationId={effectiveConversationId}
          liveTeam={liveTeam}
          isLoading={isLoadingMessages && !!effectiveConversationId}
        />
      </ConversationCostProvider>
      {streamState.phase === CHAT_STREAM_STATUS.ERROR && streamState.error && (
        <ErrorBanner
          message={streamState.error.message}
          onRetry={canRetryLastTurn ? handleRetryLastTurn : undefined}
        />
      )}
      {teamPhase === TEAM_STREAM_PHASES.ERROR && teamError && <ErrorBanner message={teamError} />}
      <ChatInput
        ref={chatInputRef}
        onSend={guardedSendMessage}
        onAbort={activeEngine === CHAT_MODES.TEAM ? abortTeam : abort}
        isStreaming={isTurnActive}
        conversationId={effectiveConversationId}
        initialModel={conversation?.model ?? undefined}
        onTeamSubmit={handleTeamSubmit}
      />
    </div>
  )
}
