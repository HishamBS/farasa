'use client'

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'
import { trpc } from '@/trpc/provider'
import { GROUP_LIMITS } from '@/config/constants'

type GroupModeContextValue = {
  groupModels: string[]
  setGroupModels: (models: string[]) => void
  judgeModel: string | undefined
  setJudgeModel: (model: string | undefined) => void
}

const GroupModeContext = createContext<GroupModeContextValue | null>(null)

export function GroupModeProvider({ children }: { children: ReactNode }) {
  const { data: prefs } = trpc.userPreferences.get.useQuery()
  const updatePrefs = trpc.userPreferences.update.useMutation()
  const updatePrefsMutate = updatePrefs.mutate

  const [groupModels, setGroupModelsState] = useState<string[]>([])
  const [judgeModel, setJudgeModelState] = useState<string | undefined>(undefined)

  const prefsGroupModels = prefs?.groupModels ?? undefined
  const prefsJudgeModel = prefs?.groupJudgeModel ?? undefined

  const resolvedGroupModels = useMemo(() => {
    const source = groupModels.length > 0 ? groupModels : (prefsGroupModels ?? [])
    return source.slice(0, GROUP_LIMITS.MAX_MODELS)
  }, [groupModels, prefsGroupModels])

  const resolvedJudgeModel = judgeModel ?? prefsJudgeModel ?? undefined

  const setGroupModels = useCallback(
    (models: string[]) => {
      setGroupModelsState(models)
      updatePrefsMutate({ groupModels: models })
    },
    [updatePrefsMutate],
  )

  const setJudgeModel = useCallback(
    (model: string | undefined) => {
      setJudgeModelState(model)
      updatePrefsMutate({ groupJudgeModel: model ?? null })
    },
    [updatePrefsMutate],
  )

  const value = useMemo(
    () => ({
      groupModels: resolvedGroupModels,
      setGroupModels,
      judgeModel: resolvedJudgeModel,
      setJudgeModel,
    }),
    [resolvedGroupModels, setGroupModels, resolvedJudgeModel, setJudgeModel],
  )

  return <GroupModeContext.Provider value={value}>{children}</GroupModeContext.Provider>
}

export function useGroupMode(): GroupModeContextValue {
  const ctx = useContext(GroupModeContext)
  if (!ctx) throw new Error('useGroupMode must be used within GroupModeProvider')
  return ctx
}
