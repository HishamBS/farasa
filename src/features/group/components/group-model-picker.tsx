'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { trpc } from '@/trpc/provider'
import { useGroupMode } from '@/features/group/context/group-context'
import { GROUP_LIMITS, PROVIDER_DOT_CLASSES, UI_TEXT } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { extractProviderKey, extractModelName } from '@/lib/utils/model'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type SelectedChipProps = {
  modelId: string
  modelLabel: string
  providerKey: string
  onRemove: (modelId: string) => void
  canRemove: boolean
  isStale?: boolean
}

function SelectedChip({
  modelId,
  modelLabel,
  providerKey,
  onRemove,
  canRemove,
  isStale,
}: SelectedChipProps) {
  const dotClass = PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-ghost)'

  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-(--border-subtle) bg-(--bg-surface) py-1 pl-2 pr-1.5 text-xs text-(--text-secondary)',
        isStale && 'opacity-50 italic',
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
      <span className="max-w-40 truncate">{modelLabel}</span>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(modelId)}
          className="flex size-4 items-center justify-center rounded-full text-(--text-ghost) hover:bg-(--bg-surface-hover) hover:text-(--text-muted)"
          aria-label={`${UI_TEXT.GROUP_MODEL_REMOVE_ARIA_PREFIX} ${modelLabel}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

export function GroupModelPicker() {
  const { groupModels, setGroupModels } = useGroupMode()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { data: modelList = [] } = trpc.model.list.useQuery()

  const modelMetaMap = useMemo(() => {
    const map = new Map<string, { name: string; provider: string }>()
    for (const model of modelList) {
      map.set(model.id, { name: model.name, provider: model.provider })
    }
    return map
  }, [modelList])

  useEffect(() => {
    if (modelList.length === 0) return
    const stale = groupModels.filter((id) => !modelMetaMap.has(id))
    if (stale.length > 0) {
      setGroupModels(groupModels.filter((id) => modelMetaMap.has(id)))
    }
  }, [groupModels, modelList.length, modelMetaMap, setGroupModels])

  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return modelList
    return modelList.filter((model) => {
      const haystack = `${model.name} ${model.id} ${model.provider}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [modelList, searchQuery])

  const canRemove = groupModels.length > GROUP_LIMITS.MIN_MODELS
  const canAddMore = groupModels.length < GROUP_LIMITS.MAX_MODELS

  const toggleModel = useCallback(
    (modelId: string) => {
      if (groupModels.includes(modelId)) {
        if (!canRemove) return
        setGroupModels(groupModels.filter((id) => id !== modelId))
        return
      }
      if (!canAddMore) return
      setGroupModels([...groupModels, modelId])
    },
    [canAddMore, canRemove, groupModels, setGroupModels],
  )

  const handleRemove = useCallback(
    (modelId: string) => {
      if (!canRemove) return
      setGroupModels(groupModels.filter((id) => id !== modelId))
    },
    [canRemove, groupModels, setGroupModels],
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groupModels.map((modelId) => {
        const meta = modelMetaMap.get(modelId)
        const isStale = modelList.length > 0 && !meta
        const label = meta?.name ?? extractModelName(modelId)
        const providerKey = meta?.provider ?? extractProviderKey(modelId)
        return (
          <SelectedChip
            key={modelId}
            modelId={modelId}
            modelLabel={label}
            providerKey={providerKey}
            onRemove={handleRemove}
            canRemove={canRemove}
            isStale={isStale}
          />
        )
      })}

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex min-h-8 items-center gap-1 rounded-full border border-dashed border-(--border-default) px-2.5 py-1 text-xs text-(--text-ghost) transition-colors hover:border-(--border-subtle) hover:text-(--text-muted)"
        aria-label={UI_TEXT.GROUP_MODEL_PICKER_OPEN_ARIA}
      >
        <Plus className="size-3" />
        {groupModels.length === 0
          ? UI_TEXT.GROUP_MODEL_HINT
          : `${groupModels.length}/${GROUP_LIMITS.MAX_MODELS}`}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{UI_TEXT.GROUP_MODEL_PICKER_TITLE}</DialogTitle>
            <DialogDescription>{UI_TEXT.GROUP_MODEL_HINT}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 overflow-hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={UI_TEXT.GROUP_MODEL_SEARCH_PLACEHOLDER}
              className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-ghost) outline-none focus:border-(--accent)"
            />

            <div className="max-h-72 overflow-y-auto rounded-lg border border-(--border-subtle)">
              {filteredModels.map((model) => {
                const isSelected = groupModels.includes(model.id)
                const providerDot = PROVIDER_DOT_CLASSES[model.provider] ?? 'bg-(--text-ghost)'
                const selectionLocked = isSelected && !canRemove
                const disabled = !isSelected && !canAddMore

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModel(model.id)}
                    disabled={selectionLocked || disabled}
                    className={cn(
                      'flex w-full items-center gap-2 border-b border-(--border-subtle) px-3 py-2 text-left transition-colors last:border-b-0',
                      isSelected
                        ? 'bg-(--accent-muted)'
                        : 'bg-transparent hover:bg-(--bg-surface-hover)',
                      (selectionLocked || disabled) && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', providerDot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-(--text-primary)">{model.name}</p>
                      <p className="truncate text-xs text-(--text-ghost)">{model.id}</p>
                    </div>
                    {isSelected && <Check className="size-3.5 text-(--accent)" />}
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              {UI_TEXT.GROUP_MODEL_PICKER_DONE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
