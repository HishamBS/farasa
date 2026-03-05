'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type StreamEngine = 'chat' | 'team'

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
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)

  const beginSession = useCallback((engine: StreamEngine, sessionId: string) => {
    setActiveSession({ engine, sessionId })
  }, [])

  const endSession = useCallback((sessionId: string) => {
    setActiveSession((current) => {
      if (!current || current.sessionId !== sessionId) return current
      return null
    })
  }, [])

  const clearSession = useCallback(() => {
    setActiveSession(null)
  }, [])

  const value = useMemo<StreamSessionContextValue>(
    () => ({
      isTurnActive: activeSession !== null,
      activeEngine: activeSession?.engine ?? null,
      beginSession,
      endSession,
      clearSession,
    }),
    [activeSession, beginSession, clearSession, endSession],
  )

  return <StreamSessionContext.Provider value={value}>{children}</StreamSessionContext.Provider>
}

export function useStreamSession(): StreamSessionContextValue {
  const ctx = useContext(StreamSessionContext)
  if (!ctx) throw new Error('useStreamSession must be used within StreamSessionProvider')
  return ctx
}
