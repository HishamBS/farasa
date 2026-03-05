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
  const [sessionsByEngine, setSessionsByEngine] = useState<
    Record<StreamEngine, ActiveSession | null>
  >({
    chat: null,
    team: null,
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
        chat: current.chat,
        team: current.team,
      }
      for (const engine of ['chat', 'team'] as const) {
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
      chat: null,
      team: null,
    })
  }, [])

  const value = useMemo<StreamSessionContextValue>(
    () => ({
      isTurnActive: sessionsByEngine.chat !== null || sessionsByEngine.team !== null,
      activeEngine: sessionsByEngine.team ? 'team' : sessionsByEngine.chat ? 'chat' : null,
      beginSession,
      endSession,
      clearSession,
    }),
    [beginSession, clearSession, endSession, sessionsByEngine.chat, sessionsByEngine.team],
  )

  return <StreamSessionContext.Provider value={value}>{children}</StreamSessionContext.Provider>
}

export function useStreamSession(): StreamSessionContextValue {
  const ctx = useContext(StreamSessionContext)
  if (!ctx) throw new Error('useStreamSession must be used within StreamSessionProvider')
  return ctx
}
