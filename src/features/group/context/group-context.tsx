'use client'

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'
import { trpc } from '@/trpc/provider'

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

  const [groupModels, setGroupModelsState] = useState<string[]>([])
  const [judgeModel, setJudgeModelState] = useState<string | undefined>(undefined)

  const prefsGroupModels =
    prefs !== undefined && 'groupModels' in prefs ? (prefs.groupModels ?? undefined) : undefined
  const prefsJudgeModel =
    prefs !== undefined && 'groupJudgeModel' in prefs
      ? (prefs.groupJudgeModel ?? undefined)
      : undefined

  const resolvedGroupModels = useMemo(
    () => (groupModels.length > 0 ? groupModels : (prefsGroupModels ?? [])),
    [groupModels, prefsGroupModels],
  )

  const resolvedJudgeModel = useMemo(
    () => judgeModel ?? prefsJudgeModel ?? undefined,
    [judgeModel, prefsJudgeModel],
  )

  const setGroupModels = useCallback(
    (models: string[]) => {
      setGroupModelsState(models)
      updatePrefs.mutate({ groupModels: models })
    },
    [updatePrefs],
  )

  const setJudgeModel = useCallback(
    (model: string | undefined) => {
      setJudgeModelState(model)
      updatePrefs.mutate({ groupJudgeModel: model ?? null })
    },
    [updatePrefs],
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
