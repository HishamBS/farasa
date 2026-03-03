'use client'

import { TITLEBAR_PHASE } from '@/config/constants'
import type { ModelSelectionState, StatusMessage, TitlebarPhase } from '@/types/stream'
import { createContext, useContext, useState } from 'react'

interface StreamPhaseContextValue {
  phase: TitlebarPhase
  setPhase: (phase: TitlebarPhase) => void
  modelSelection: ModelSelectionState | null
  setModelSelection: (sel: ModelSelectionState | null) => void
  hasText: boolean
  setHasText: (v: boolean) => void
  statusMessages: StatusMessage[]
  setStatusMessages: (statusMessages: StatusMessage[]) => void
  hasThinking: boolean
  setHasThinking: (value: boolean) => void
  hasToolActivity: boolean
  setHasToolActivity: (value: boolean) => void
}

const StreamPhaseContext = createContext<StreamPhaseContextValue>({
  phase: TITLEBAR_PHASE.IDLE,
  setPhase: () => undefined,
  modelSelection: null,
  setModelSelection: () => undefined,
  hasText: false,
  setHasText: () => undefined,
  statusMessages: [],
  setStatusMessages: () => undefined,
  hasThinking: false,
  setHasThinking: () => undefined,
  hasToolActivity: false,
  setHasToolActivity: () => undefined,
})

export function StreamPhaseProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<TitlebarPhase>(TITLEBAR_PHASE.IDLE)
  const [modelSelection, setModelSelection] = useState<ModelSelectionState | null>(null)
  const [hasText, setHasText] = useState(false)
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([])
  const [hasThinking, setHasThinking] = useState(false)
  const [hasToolActivity, setHasToolActivity] = useState(false)

  return (
    <StreamPhaseContext.Provider
      value={{
        phase,
        setPhase,
        modelSelection,
        setModelSelection,
        hasText,
        setHasText,
        statusMessages,
        setStatusMessages,
        hasThinking,
        setHasThinking,
        hasToolActivity,
        setHasToolActivity,
      }}
    >
      {children}
    </StreamPhaseContext.Provider>
  )
}

export function useStreamPhase(): StreamPhaseContextValue {
  return useContext(StreamPhaseContext)
}
