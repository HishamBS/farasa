'use client'

import { useCallback, useRef, useMemo } from 'react'
import { X } from 'lucide-react'
import { ModelSelector } from '@/features/chat/components/model-selector'
import { useGroupMode } from '@/features/group/context/group-context'
import { PROVIDER_DOT_CLASSES, GROUP_LIMITS } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { extractProviderKey, extractModelName } from '@/lib/utils/model'
import { trpc } from '@/trpc/provider'
import type { ModelSelectorHandle } from '@/features/chat/components/model-selector'

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

  const handleRemove = useCallback(() => {
    onRemove(modelId)
  }, [modelId, onRemove])

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--border-subtle) bg-(--bg-surface) py-1 pl-2 pr-1.5 text-xs text-(--text-secondary)">
      <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
      <span className="max-w-24 truncate font-mono">{modelLabel}</span>
      {canRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="flex size-4 items-center justify-center rounded-full text-(--text-ghost) hover:bg-(--bg-surface-hover) hover:text-(--text-muted)"
          aria-label={`Remove ${modelLabel}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

export function GroupModelPicker() {
  const { groupModels, setGroupModels } = useGroupMode()
  const selectorRef = useRef<ModelSelectorHandle>(null)
  const { data: modelList = [] } = trpc.model.list.useQuery()

  const modelMetaMap = useMemo(() => {
    const map = new Map<string, { name: string; provider: string }>()
    for (const m of modelList) {
      map.set(m.id, { name: m.name, provider: m.provider })
    }
    return map
  }, [modelList])

  const canAdd = groupModels.length < GROUP_LIMITS.MAX_MODELS
  const canRemove = groupModels.length > GROUP_LIMITS.MIN_MODELS

  const handleRemove = useCallback(
    (modelId: string) => {
      if (!canRemove) return
      setGroupModels(groupModels.filter((id) => id !== modelId))
    },
    [canRemove, groupModels, setGroupModels],
  )

  const handleAdd = useCallback(
    (modelId: string | undefined) => {
      if (!modelId || !canAdd) return
      if (groupModels.includes(modelId)) return
      setGroupModels([...groupModels, modelId])
    },
    [canAdd, groupModels, setGroupModels],
  )

  const handleOpenSelector = useCallback(() => {
    if (!canAdd) return
    selectorRef.current?.open()
  }, [canAdd])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groupModels.map((modelId) => {
        const meta = modelMetaMap.get(modelId)
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
          />
        )
      })}

      {canAdd && (
        <div className="relative">
          <button
            type="button"
            onClick={handleOpenSelector}
            className="flex items-center gap-1 rounded-full border border-dashed border-(--border-default) px-2.5 py-1 text-xs text-(--text-ghost) transition-colors hover:border-(--border-subtle) hover:text-(--text-muted)"
            aria-label="Add model"
          >
            <span className="text-base leading-none">+</span>
            <span>Add model</span>
          </button>
          <div className="absolute bottom-full left-0 hidden">
            <ModelSelector ref={selectorRef} value={undefined} onChange={handleAdd} />
          </div>
        </div>
      )}

      {groupModels.length === 0 && (
        <p className="text-xs text-(--text-ghost)">
          Select {GROUP_LIMITS.MIN_MODELS}–{GROUP_LIMITS.MAX_MODELS} models to compare
        </p>
      )}
    </div>
  )
}
