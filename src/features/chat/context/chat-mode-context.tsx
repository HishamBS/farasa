'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { CHAT_MODES } from '@/config/constants'
import type { SearchMode } from '@/schemas/search'

type ChatModeContextValue = {
  mode: SearchMode
  setMode: (mode: SearchMode) => void
}

const ChatModeContext = createContext<ChatModeContextValue | null>(null)

export function ChatModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SearchMode>(CHAT_MODES.CHAT)
  return <ChatModeContext.Provider value={{ mode, setMode }}>{children}</ChatModeContext.Provider>
}

export function useChatMode(): ChatModeContextValue {
  const ctx = useContext(ChatModeContext)
  if (!ctx) throw new Error('useChatMode must be used within ChatModeProvider')
  return ctx
}
