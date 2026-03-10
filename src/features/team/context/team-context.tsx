'use client'

import { TEAM_LIMITS } from '@/config/constants'
import { trpc } from '@/trpc/provider'
import { useUpdatePreferences } from '@/trpc/mutations'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'

type TeamModeContextValue = {
  teamModels: string[]
  setTeamModels: (models: string[]) => void
  synthesisModel: string | undefined
  setSynthesisModel: (model: string | undefined) => void
}

const TeamModeContext = createContext<TeamModeContextValue | null>(null)

export function TeamModeProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ id?: string[] }>()
  const conversationId = Array.isArray(params.id) ? params.id[0] : undefined
  const utils = trpc.useUtils()
  const { data: prefs } = trpc.userPreferences.get.useQuery()
  const updatePrefs = useUpdatePreferences()
  const updatePrefsMutate = updatePrefs.mutate
  const updateConversation = trpc.conversation.update.useMutation({
    onSettled: (_data, _error, variables) => {
      void utils.conversation.getById.invalidate({ id: variables.id })
    },
  })
  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: conversationId ?? '' },
    { enabled: Boolean(conversationId) },
  )

  const [teamModels, setTeamModelsState] = useState<string[]>([])
  const [synthesisModel, setSynthesisModelState] = useState<string | undefined>(undefined)

  const prefsTeamModels = prefs?.teamModels ?? undefined
  const prefsSynthesisModel = prefs?.teamSynthesizerModel ?? undefined
  const conversationTeamModels = conversation?.teamModels ?? undefined
  const conversationSynthesisModel = conversation?.teamSynthesizerModel ?? undefined

  const resolvedTeamModels = useMemo(() => {
    const source =
      teamModels.length > 0 ? teamModels : (conversationTeamModels ?? prefsTeamModels ?? [])
    return source.slice(0, TEAM_LIMITS.MAX_MODELS)
  }, [conversationTeamModels, prefsTeamModels, teamModels])

  const resolvedSynthesisModel =
    synthesisModel ?? conversationSynthesisModel ?? prefsSynthesisModel ?? undefined

  const setTeamModels = useCallback(
    (models: string[]) => {
      setTeamModelsState(models)
      if (conversationId) {
        updateConversation.mutate({ id: conversationId, teamModels: models })
        return
      }
      updatePrefsMutate({ teamModels: models })
    },
    [conversationId, updateConversation, updatePrefsMutate],
  )

  const setSynthesisModel = useCallback(
    (model: string | undefined) => {
      setSynthesisModelState(model)
      if (conversationId) {
        updateConversation.mutate({
          id: conversationId,
          teamSynthesizerModel: model ?? null,
        })
        return
      }
      updatePrefsMutate({ teamSynthesizerModel: model ?? null })
    },
    [conversationId, updateConversation, updatePrefsMutate],
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
