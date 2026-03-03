'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PROVIDER_DOT_CLASSES, UI_TEXT } from '@/config/constants'
import { useTeamMode } from '@/features/team/context/team-context'
import { cn } from '@/lib/utils/cn'
import { extractModelName } from '@/lib/utils/model'
import { trpc } from '@/trpc/provider'
import { Check, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type TeamModelOption = {
  id: string
  name: string
  provider: string
  selected: boolean
  selectable: boolean
  reasonCode?: string
}

type SelectedChipProps = {
  modelId: string
  modelLabel: string
  providerKey: string
  onRemove: (modelId: string) => void
  canRemove: boolean
}

function SelectedChip({
  modelId,
  modelLabel,
  providerKey,
  onRemove,
  canRemove,
}: SelectedChipProps) {
  const dotClass = PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-ghost)'

  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-(--border-subtle) bg-(--bg-surface) py-1 pl-2 pr-1.5 text-xs text-(--text-secondary)">
      <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
      <span className="max-w-40 truncate">{modelLabel}</span>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(modelId)}
          className="flex size-4 items-center justify-center rounded-full text-(--text-ghost) hover:bg-(--bg-surface-hover) hover:text-(--text-muted)"
          aria-label={`${UI_TEXT.TEAM_MODEL_REMOVE_ARIA_PREFIX} ${modelLabel}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

export function TeamModelPicker() {
  const { teamModels, setTeamModels } = useTeamMode()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const policyQuery = trpc.team.policy.useQuery({ selectedModelIds: teamModels })
  const policy = policyQuery.data

  useEffect(() => {
    if (!policy) return
    const current = teamModels.join(',')
    const normalized = policy.normalizedSelectedModelIds.join(',')
    if (current !== normalized) {
      setTeamModels(policy.normalizedSelectedModelIds)
    }
  }, [policy, setTeamModels, teamModels])

  const optionById = useMemo(() => {
    const map = new Map<string, TeamModelOption>()
    for (const option of policy?.teamModelOptions ?? []) {
      map.set(option.id, option)
    }
    return map
  }, [policy])

  const selectedModelIds = policy?.normalizedSelectedModelIds ?? teamModels
  const selectedCount = selectedModelIds.length
  const canRemove = policy ? selectedCount > policy.minModels : false
  const maxModels = policy?.maxModels ?? selectedCount

  const filteredModels = useMemo(() => {
    const models = policy?.teamModelOptions ?? []
    const query = searchQuery.trim().toLowerCase()
    if (!query) return models
    return models.filter((model) => {
      const haystack = `${model.name} ${model.id} ${model.provider}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [policy?.teamModelOptions, searchQuery])

  const toggleModel = useCallback(
    (modelId: string) => {
      const option = optionById.get(modelId)
      if (!option || !option.selectable) return
      if (option.selected) {
        setTeamModels(selectedModelIds.filter((id) => id !== modelId))
        return
      }
      setTeamModels([...selectedModelIds, modelId])
    },
    [optionById, selectedModelIds, setTeamModels],
  )

  const handleRemove = useCallback(
    (modelId: string) => {
      if (!canRemove) return
      setTeamModels(selectedModelIds.filter((id) => id !== modelId))
    },
    [canRemove, selectedModelIds, setTeamModels],
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedModelIds.map((modelId) => {
        const meta = optionById.get(modelId)
        const label = meta?.name ?? extractModelName(modelId)
        const providerKey = meta?.provider ?? 'unknown'
        return (
          <SelectedChip
            key={modelId}
            modelId={modelId}
            modelLabel={label}
            providerKey={providerKey}
            onRemove={handleRemove}
            canRemove={canRemove}
          />
        )
      })}

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex min-h-8 items-center gap-1 rounded-full border border-dashed border-(--border-default) px-2.5 py-1 text-xs text-(--text-ghost) transition-colors hover:border-(--border-subtle) hover:text-(--text-muted)"
        aria-label={UI_TEXT.TEAM_MODEL_PICKER_OPEN_ARIA}
      >
        <Plus className="size-3" />
        {selectedCount === 0 ? UI_TEXT.TEAM_MODEL_HINT : `${selectedCount}/${maxModels}`}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{UI_TEXT.TEAM_MODEL_PICKER_TITLE}</DialogTitle>
            <DialogDescription>{UI_TEXT.TEAM_MODEL_HINT}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 overflow-hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={UI_TEXT.MODEL_SEARCH_PLACEHOLDER}
              className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-ghost) outline-none focus:border-(--accent)"
            />

            <div className="max-h-72 overflow-y-auto rounded-lg border border-(--border-subtle)">
              {filteredModels.map((model) => {
                const providerDot = PROVIDER_DOT_CLASSES[model.provider] ?? 'bg-(--text-ghost)'
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModel(model.id)}
                    disabled={!model.selectable}
                    className={cn(
                      'flex w-full items-center gap-2 border-b border-(--border-subtle) px-3 py-2 text-left transition-colors last:border-b-0',
                      model.selected
                        ? 'bg-(--accent-muted)'
                        : 'bg-transparent hover:bg-(--bg-surface-hover)',
                      !model.selectable && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', providerDot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-(--text-primary)">{model.name}</p>
                      <p className="truncate text-xs text-(--text-ghost)">{model.id}</p>
                    </div>
                    {model.selected && <Check className="size-3.5 text-(--accent)" />}
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              {UI_TEXT.TEAM_MODEL_PICKER_DONE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
