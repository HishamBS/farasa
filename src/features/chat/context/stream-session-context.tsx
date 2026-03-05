'use client'

import { CHAT_MODES } from '@/config/constants'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type StreamEngine = (typeof CHAT_MODES)[keyof typeof CHAT_MODES]

type ActiveSession = {
  sessionId: string
  engine: StreamEngine
}

type StreamSessionContextValue = {
  isTurnActive: boolean
  activeEngine: StreamEngine | null
  beginSession: (engine: StreamEngine, sessionId: string) => void
  endSession: (sessionId: string) => void
  clearSession: () => void
}

const StreamSessionContext = createContext<StreamSessionContextValue | null>(null)

export function StreamSessionProvider({ children }: { children: ReactNode }) {
  const [sessionsByEngine, setSessionsByEngine] = useState<
    Record<StreamEngine, ActiveSession | null>
  >({
    [CHAT_MODES.CHAT]: null,
    [CHAT_MODES.TEAM]: null,
  })

  const beginSession = useCallback((engine: StreamEngine, sessionId: string) => {
    setSessionsByEngine((current) => ({
      ...current,
      [engine]: { engine, sessionId },
    }))
  }, [])

  const endSession = useCallback((sessionId: string) => {
    setSessionsByEngine((current) => {
      let changed = false
      const next: Record<StreamEngine, ActiveSession | null> = {
        [CHAT_MODES.CHAT]: current[CHAT_MODES.CHAT],
        [CHAT_MODES.TEAM]: current[CHAT_MODES.TEAM],
      }
      for (const engine of [CHAT_MODES.CHAT, CHAT_MODES.TEAM] as const) {
        if (current[engine]?.sessionId === sessionId) {
          next[engine] = null
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [])

  const clearSession = useCallback(() => {
    setSessionsByEngine({
      [CHAT_MODES.CHAT]: null,
      [CHAT_MODES.TEAM]: null,
    })
  }, [])

  const chatSession = sessionsByEngine[CHAT_MODES.CHAT]
  const teamSession = sessionsByEngine[CHAT_MODES.TEAM]

  const value = useMemo<StreamSessionContextValue>(
    () => ({
      isTurnActive: chatSession !== null || teamSession !== null,
      activeEngine: teamSession ? CHAT_MODES.TEAM : chatSession ? CHAT_MODES.CHAT : null,
      beginSession,
      endSession,
      clearSession,
    }),
    [beginSession, clearSession, endSession, chatSession, teamSession],
  )

  return <StreamSessionContext.Provider value={value}>{children}</StreamSessionContext.Provider>
}

export function useStreamSession(): StreamSessionContextValue {
  const ctx = useContext(StreamSessionContext)
  if (!ctx) throw new Error('useStreamSession must be used within StreamSessionProvider')
  return ctx
}
