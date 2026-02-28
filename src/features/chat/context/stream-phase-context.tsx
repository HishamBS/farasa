'use client'

import { createContext, useContext, useState } from 'react'
import type { TitlebarPhase } from '@/types/stream'
import { TITLEBAR_PHASE } from '@/config/constants'

interface StreamPhaseContextValue {
  phase: TitlebarPhase
  setPhase: (phase: TitlebarPhase) => void
}

const StreamPhaseContext = createContext<StreamPhaseContextValue>({
  phase: TITLEBAR_PHASE.IDLE,
  setPhase: () => undefined,
})

export function StreamPhaseProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<TitlebarPhase>(TITLEBAR_PHASE.IDLE)
  return (
    <StreamPhaseContext.Provider value={{ phase, setPhase }}>
      {children}
    </StreamPhaseContext.Provider>
  )
}

export function useStreamPhase(): StreamPhaseContextValue {
  return useContext(StreamPhaseContext)
}
