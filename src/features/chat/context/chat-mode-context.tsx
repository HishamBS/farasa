'use client'

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import { CHAT_MODES } from '@/config/constants'
import type { ChatMode } from '@/schemas/message'

type ChatModeContextValue = {
  mode: ChatMode
  setMode: (mode: ChatMode) => void
}

const ChatModeContext = createContext<ChatModeContextValue | null>(null)

export function ChatModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ChatMode>(CHAT_MODES.CHAT)
  const value = useMemo(() => ({ mode, setMode }), [mode])
  return <ChatModeContext.Provider value={value}>{children}</ChatModeContext.Provider>
}

export function useChatMode(): ChatModeContextValue {
  const ctx = useContext(ChatModeContext)
  if (!ctx) throw new Error('useChatMode must be used within ChatModeProvider')
  return ctx
}
