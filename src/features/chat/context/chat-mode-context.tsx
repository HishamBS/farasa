'use client'

import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react'
import { BROWSER_EVENTS, CHAT_MODES } from '@/config/constants'
import type { ChatMode } from '@/schemas/message'

type ChatModeContextValue = {
  mode: ChatMode
  setMode: (mode: ChatMode) => void
  webSearchEnabled: boolean
  setWebSearchEnabled: (enabled: boolean) => void
}

const ChatModeContext = createContext<ChatModeContextValue | null>(null)

export function ChatModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ChatMode>(CHAT_MODES.CHAT)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)

  useEffect(() => {
    const onNewChatRequested = () => {
      setMode(CHAT_MODES.CHAT)
      setWebSearchEnabled(false)
    }
    window.addEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, onNewChatRequested)
    return () => window.removeEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, onNewChatRequested)
  }, [])

  const value = useMemo(
    () => ({ mode, setMode, webSearchEnabled, setWebSearchEnabled }),
    [mode, webSearchEnabled],
  )
  return <ChatModeContext.Provider value={value}>{children}</ChatModeContext.Provider>
}

export function useChatMode(): ChatModeContextValue {
  const ctx = useContext(ChatModeContext)
  if (!ctx) throw new Error('useChatMode must be used within ChatModeProvider')
  return ctx
}
