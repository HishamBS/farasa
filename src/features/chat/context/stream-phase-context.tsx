'use client'

import { createContext, useContext, useState } from 'react'
import type { TitlebarPhase } from '@/types/stream'

interface StreamPhaseContextValue {
  phase: TitlebarPhase
  setPhase: (phase: TitlebarPhase) => void
}

const StreamPhaseContext = createContext<StreamPhaseContextValue>({
  phase: 'idle',
  setPhase: () => undefined,
})

export function StreamPhaseProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<TitlebarPhase>('idle')
  return (
    <StreamPhaseContext.Provider value={{ phase, setPhase }}>
      {children}
    </StreamPhaseContext.Provider>
  )
}

export function useStreamPhase(): StreamPhaseContextValue {
  return useContext(StreamPhaseContext)
}
