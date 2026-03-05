'use client'

import { trpc } from '@/trpc/provider'
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { BROWSER_EVENTS, CHAT_MODES } from '@/config/constants'
import type { ChatMode } from '@/schemas/message'
import { useStreamSession } from './stream-session-context'

type ChatModeContextValue = {
  mode: ChatMode
  setMode: (mode: ChatMode) => void
  webSearchEnabled: boolean
  setWebSearchEnabled: (enabled: boolean) => void
  setActiveConversationId: (conversationId: string | undefined) => void
  hydrateFromConversation: (conversation: {
    id: string
    mode: ChatMode
    webSearchEnabled: boolean
    settingsVersion: number
  }) => void
  isHydrated: boolean
}

const ChatModeContext = createContext<ChatModeContextValue | null>(null)

export function ChatModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ChatMode>(CHAT_MODES.CHAT)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined)
  const pendingSettingsRef = useRef<{
    conversationId: string | undefined
    mode?: ChatMode
    webSearchEnabled?: boolean
  } | null>(null)
  const hydrationRef = useRef<{ conversationId: string; settingsVersion: number } | null>(null)
  const [hydratedConversationId, setHydratedConversationId] = useState<string | null>(null)
  const { isTurnActive } = useStreamSession()
  const utils = trpc.useUtils()
  const updateConversationMutation = trpc.conversation.update.useMutation({
    onMutate: async (variables) => {
      await utils.conversation.getById.cancel({ id: variables.id })
      const previous = utils.conversation.getById.getData({ id: variables.id })
      utils.conversation.getById.setData({ id: variables.id }, (old) =>
        old
          ? {
              ...old,
              ...(variables.mode !== undefined ? { mode: variables.mode } : {}),
              ...(variables.webSearchEnabled !== undefined
                ? { webSearchEnabled: variables.webSearchEnabled }
                : {}),
              settingsVersion:
                variables.mode !== undefined || variables.webSearchEnabled !== undefined
                  ? (old.settingsVersion ?? 0) + 1
                  : old.settingsVersion,
            }
          : old,
      )
      return { previous, id: variables.id }
    },
    onError: (_error, _variables, context) => {
      if (!context?.previous || !context.id) return
      utils.conversation.getById.setData({ id: context.id }, context.previous)
    },
    onSettled: async (_data, _error, variables) => {
      await utils.conversation.getById.invalidate({ id: variables.id })
      await utils.conversation.list.invalidate()
    },
  })

  const persistSettings = useCallback(
    (next: { mode?: ChatMode; webSearchEnabled?: boolean }) => {
      if (!activeConversationId) return
      if (next.mode === undefined && next.webSearchEnabled === undefined) return
      updateConversationMutation.mutate({
        id: activeConversationId,
        ...(next.mode !== undefined ? { mode: next.mode } : {}),
        ...(next.webSearchEnabled !== undefined ? { webSearchEnabled: next.webSearchEnabled } : {}),
      })
    },
    [activeConversationId, updateConversationMutation],
  )

  const requestModeChange = useCallback(
    (nextMode: ChatMode) => {
      setMode(nextMode)
      if (isTurnActive) {
        pendingSettingsRef.current = {
          ...(pendingSettingsRef.current ?? {}),
          conversationId: pendingSettingsRef.current?.conversationId ?? activeConversationId,
          mode: nextMode,
        }
        return
      }
      persistSettings({ mode: nextMode })
    },
    [activeConversationId, isTurnActive, persistSettings],
  )

  const requestWebSearchChange = useCallback(
    (enabled: boolean) => {
      setWebSearchEnabled(enabled)
      if (isTurnActive) {
        pendingSettingsRef.current = {
          ...(pendingSettingsRef.current ?? {}),
          conversationId: pendingSettingsRef.current?.conversationId ?? activeConversationId,
          webSearchEnabled: enabled,
        }
        return
      }
      persistSettings({ webSearchEnabled: enabled })
    },
    [activeConversationId, isTurnActive, persistSettings],
  )

  const hydrateFromConversation = useCallback(
    (conversation: {
      id: string
      mode: ChatMode
      webSearchEnabled: boolean
      settingsVersion: number
    }) => {
      const latest = hydrationRef.current
      if (
        latest &&
        latest.conversationId === conversation.id &&
        conversation.settingsVersion < latest.settingsVersion
      ) {
        return
      }
      hydrationRef.current = {
        conversationId: conversation.id,
        settingsVersion: conversation.settingsVersion,
      }
      setHydratedConversationId(conversation.id)

      const pending = pendingSettingsRef.current
      if (activeConversationId !== conversation.id) {
        setActiveConversationId(conversation.id)
      }
      const pendingBelongsToConversation =
        pending !== null &&
        (pending.conversationId === conversation.id || pending.conversationId === undefined)
      if (pendingBelongsToConversation) {
        if (pending && pending.conversationId === undefined) {
          pendingSettingsRef.current = { ...pending, conversationId: conversation.id }
        }
        setMode(pending?.mode ?? conversation.mode)
        setWebSearchEnabled(pending?.webSearchEnabled ?? conversation.webSearchEnabled)
        return
      }

      setMode(conversation.mode)
      setWebSearchEnabled(conversation.webSearchEnabled)
    },
    [activeConversationId],
  )

  useEffect(() => {
    const onNewChatRequested = () => {
      setMode(CHAT_MODES.CHAT)
      setWebSearchEnabled(false)
      setActiveConversationId(undefined)
      pendingSettingsRef.current = null
      hydrationRef.current = null
      setHydratedConversationId(null)
    }
    window.addEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, onNewChatRequested)
    return () => window.removeEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, onNewChatRequested)
  }, [])

  useEffect(() => {
    if (isTurnActive) return
    const pending = pendingSettingsRef.current
    if (!pending) return
    if (pending.conversationId && pending.conversationId !== activeConversationId) return
    pendingSettingsRef.current = null
    persistSettings(pending)
  }, [activeConversationId, isTurnActive, persistSettings])

  const isHydrated = !activeConversationId || hydratedConversationId === activeConversationId

  const value = useMemo(
    () => ({
      mode,
      setMode: requestModeChange,
      webSearchEnabled,
      setWebSearchEnabled: requestWebSearchChange,
      setActiveConversationId,
      hydrateFromConversation,
      isHydrated,
    }),
    [
      mode,
      requestModeChange,
      webSearchEnabled,
      requestWebSearchChange,
      setActiveConversationId,
      hydrateFromConversation,
      isHydrated,
    ],
  )
  return <ChatModeContext.Provider value={value}>{children}</ChatModeContext.Provider>
}

export function useChatMode(): ChatModeContextValue {
  const ctx = useContext(ChatModeContext)
  if (!ctx) throw new Error('useChatMode must be used within ChatModeProvider')
  return ctx
}
