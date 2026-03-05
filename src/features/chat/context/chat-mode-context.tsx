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
  }) => void
}

const ChatModeContext = createContext<ChatModeContextValue | null>(null)

export function ChatModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ChatMode>(CHAT_MODES.CHAT)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined)
  const pendingSettingsRef = useRef<{
    mode?: ChatMode
    webSearchEnabled?: boolean
  } | null>(null)
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
          mode: nextMode,
        }
        return
      }
      persistSettings({ mode: nextMode })
    },
    [isTurnActive, persistSettings],
  )

  const requestWebSearchChange = useCallback(
    (enabled: boolean) => {
      setWebSearchEnabled(enabled)
      if (isTurnActive) {
        pendingSettingsRef.current = {
          ...(pendingSettingsRef.current ?? {}),
          webSearchEnabled: enabled,
        }
        return
      }
      persistSettings({ webSearchEnabled: enabled })
    },
    [isTurnActive, persistSettings],
  )

  const hydrateFromConversation = useCallback(
    (conversation: { id: string; mode: ChatMode; webSearchEnabled: boolean }) => {
      const pending = pendingSettingsRef.current
      if (activeConversationId !== conversation.id) {
        setActiveConversationId(conversation.id)
      }

      if (updateConversationMutation.isPending && activeConversationId === conversation.id) {
        return
      }

      setMode(pending?.mode ?? conversation.mode)
      setWebSearchEnabled(pending?.webSearchEnabled ?? conversation.webSearchEnabled)
    },
    [activeConversationId, updateConversationMutation.isPending],
  )

  useEffect(() => {
    const onNewChatRequested = () => {
      setMode(CHAT_MODES.CHAT)
      setWebSearchEnabled(false)
      setActiveConversationId(undefined)
      pendingSettingsRef.current = null
    }
    window.addEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, onNewChatRequested)
    return () => window.removeEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, onNewChatRequested)
  }, [])

  useEffect(() => {
    if (isTurnActive) return
    const pending = pendingSettingsRef.current
    if (!pending) return
    pendingSettingsRef.current = null
    persistSettings(pending)
  }, [isTurnActive, persistSettings])

  const value = useMemo(
    () => ({
      mode,
      setMode: requestModeChange,
      webSearchEnabled,
      setWebSearchEnabled: requestWebSearchChange,
      setActiveConversationId,
      hydrateFromConversation,
    }),
    [
      mode,
      requestModeChange,
      webSearchEnabled,
      requestWebSearchChange,
      setActiveConversationId,
      hydrateFromConversation,
    ],
  )
  return <ChatModeContext.Provider value={value}>{children}</ChatModeContext.Provider>
}

export function useChatMode(): ChatModeContextValue {
  const ctx = useContext(ChatModeContext)
  if (!ctx) throw new Error('useChatMode must be used within ChatModeProvider')
  return ctx
}
