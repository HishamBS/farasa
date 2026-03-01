'use client'

import { createContext, useContext, useState } from 'react'
import type { TitlebarPhase, ModelSelectionState } from '@/types/stream'
import { TITLEBAR_PHASE } from '@/config/constants'

interface StreamPhaseContextValue {
  phase: TitlebarPhase
  setPhase: (phase: TitlebarPhase) => void
  modelSelection: ModelSelectionState | null
  setModelSelection: (sel: ModelSelectionState | null) => void
  hasText: boolean
  setHasText: (v: boolean) => void
}

const StreamPhaseContext = createContext<StreamPhaseContextValue>({
  phase: TITLEBAR_PHASE.IDLE,
  setPhase: () => undefined,
  modelSelection: null,
  setModelSelection: () => undefined,
  hasText: false,
  setHasText: () => undefined,
})

export function StreamPhaseProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<TitlebarPhase>(TITLEBAR_PHASE.IDLE)
  const [modelSelection, setModelSelection] = useState<ModelSelectionState | null>(null)
  const [hasText, setHasText] = useState(false)

  return (
    <StreamPhaseContext.Provider
      value={{ phase, setPhase, modelSelection, setModelSelection, hasText, setHasText }}
    >
      {children}
    </StreamPhaseContext.Provider>
  )
}

export function useStreamPhase(): StreamPhaseContextValue {
  return useContext(StreamPhaseContext)
}
