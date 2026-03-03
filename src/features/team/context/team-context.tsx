'use client'

import { TEAM_LIMITS } from '@/config/constants'
import { trpc } from '@/trpc/provider'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type TeamModeContextValue = {
  teamModels: string[]
  setTeamModels: (models: string[]) => void
  synthesisModel: string | undefined
  setSynthesisModel: (model: string | undefined) => void
}

const TeamModeContext = createContext<TeamModeContextValue | null>(null)

export function TeamModeProvider({ children }: { children: ReactNode }) {
  const { data: prefs } = trpc.userPreferences.get.useQuery()
  const updatePrefs = trpc.userPreferences.update.useMutation()
  const updatePrefsMutate = updatePrefs.mutate

  const [teamModels, setTeamModelsState] = useState<string[]>([])
  const [synthesisModel, setSynthesisModelState] = useState<string | undefined>(undefined)

  const prefsTeamModels = prefs?.teamModels ?? undefined
  const prefsSynthesisModel = prefs?.teamSynthesizerModel ?? undefined

  const resolvedTeamModels = useMemo(() => {
    const source = teamModels.length > 0 ? teamModels : (prefsTeamModels ?? [])
    return source.slice(0, TEAM_LIMITS.MAX_MODELS)
  }, [teamModels, prefsTeamModels])

  const resolvedSynthesisModel = synthesisModel ?? prefsSynthesisModel ?? undefined

  const setTeamModels = useCallback(
    (models: string[]) => {
      setTeamModelsState(models)
      updatePrefsMutate({ teamModels: models })
    },
    [updatePrefsMutate],
  )

  const setSynthesisModel = useCallback(
    (model: string | undefined) => {
      setSynthesisModelState(model)
      updatePrefsMutate({ teamSynthesizerModel: model ?? null })
    },
    [updatePrefsMutate],
  )

  const value = useMemo(
    () => ({
      teamModels: resolvedTeamModels,
      setTeamModels,
      synthesisModel: resolvedSynthesisModel,
      setSynthesisModel,
    }),
    [resolvedTeamModels, setTeamModels, resolvedSynthesisModel, setSynthesisModel],
  )

  return <TeamModeContext.Provider value={value}>{children}</TeamModeContext.Provider>
}

export function useTeamMode(): TeamModeContextValue {
  const ctx = useContext(TeamModeContext)
  if (!ctx) throw new Error('useTeamMode must be used within TeamModeProvider')
  return ctx
}
