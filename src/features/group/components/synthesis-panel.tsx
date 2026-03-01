'use client'

import { useCallback, useMemo, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { ModelSelector } from '@/features/chat/components/model-selector'
import { useGroupMode } from '@/features/group/context/group-context'
import { PROVIDER_DOT_CLASSES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { extractProviderKey, extractModelName } from '@/lib/utils/model'
import type { ModelSelectorHandle } from '@/features/chat/components/model-selector'
import type { UseSynthesisReturn } from '@/features/group/hooks/use-group-synthesis'

type SynthesisPanelProps = {
  comparisonModelIds: string[]
  conversationId: string
  groupId: string
  groupDone: boolean
  synthesis: UseSynthesisReturn
}

type ModelChipProps = {
  modelId: string
  isSelected: boolean
  onSelect: (modelId: string) => void
}

function ModelChip({ modelId, isSelected, onSelect }: ModelChipProps) {
  const providerKey = extractProviderKey(modelId)
  const label = extractModelName(modelId)
  const initials = label
    .split(/[-./]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  const dotClass = PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-ghost)'

  const handleClick = useCallback(() => {
    onSelect(modelId)
  }, [modelId, onSelect])

  return (
    <button
      type="button"
      onClick={handleClick}
      title={modelId}
      className={cn(
        'flex size-9 flex-col items-center justify-center rounded-full border text-[0.625rem] font-mono font-semibold transition-all',
        isSelected
          ? 'border-(--accent) bg-(--accent-muted) text-accent ring-2 ring-(--accent) ring-offset-1 ring-offset-(--bg-root)'
          : 'border-(--border-subtle) bg-(--bg-surface) text-(--text-muted) hover:border-(--border-default) hover:text-(--text-secondary)',
      )}
      aria-pressed={isSelected}
      aria-label={`Select ${label} as judge`}
    >
      <span className={cn('mb-0.5 size-1.5 rounded-full', dotClass)} />
      <span>{initials || label.slice(0, 2).toUpperCase()}</span>
    </button>
  )
}

export function SynthesisPanel({
  comparisonModelIds,
  conversationId,
  groupId,
  groupDone,
  synthesis,
}: SynthesisPanelProps) {
  const { judgeModel, setJudgeModel } = useGroupMode()
  const modelSelectorRef = useRef<ModelSelectorHandle>(null)
  const { trigger, isSynthesizing, synthesisText, error: synthesisError } = synthesis

  const canSynthesize = groupDone && !!judgeModel && !isSynthesizing

  const handleSelectJudge = useCallback(
    (modelId: string) => {
      setJudgeModel(judgeModel === modelId ? undefined : modelId)
    },
    [judgeModel, setJudgeModel],
  )

  const handleJudgeFromSelector = useCallback(
    (modelId: string | undefined) => {
      setJudgeModel(modelId)
    },
    [setJudgeModel],
  )

  const handleOpenSelector = useCallback(() => {
    modelSelectorRef.current?.open()
  }, [])

  const handleSynthesize = useCallback(() => {
    if (!canSynthesize || !judgeModel) return
    trigger({ groupId, conversationId, judgeModel })
  }, [canSynthesize, judgeModel, trigger, groupId, conversationId])

  const selectedJudgeLabel = useMemo(() => {
    if (!judgeModel) return null
    return extractModelName(judgeModel)
  }, [judgeModel])

  return (
    <div className="space-y-4 py-1">
      <div className="space-y-2">
        <p className="text-xs font-medium text-(--text-muted)">Select judge model</p>
        <div className="flex flex-wrap items-center gap-2">
          {comparisonModelIds.map((id) => (
            <ModelChip
              key={id}
              modelId={id}
              isSelected={judgeModel === id}
              onSelect={handleSelectJudge}
            />
          ))}
          <button
            type="button"
            onClick={handleOpenSelector}
            className="flex size-9 items-center justify-center rounded-full border border-dashed border-(--border-default) text-(--text-ghost) transition-colors hover:border-(--border-subtle) hover:text-(--text-muted)"
            aria-label="Open model selector"
          >
            <span className="text-base leading-none">+</span>
          </button>
          <div className="hidden">
            <ModelSelector
              ref={modelSelectorRef}
              value={judgeModel}
              onChange={handleJudgeFromSelector}
            />
          </div>
        </div>
        {selectedJudgeLabel && (
          <p className="text-xs text-(--text-ghost)">
            Judge: <span className="font-mono text-(--text-muted)">{selectedJudgeLabel}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSynthesize}
          disabled={!canSynthesize}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            canSynthesize
              ? 'bg-(--accent) text-white hover:bg-(--accent-hover)'
              : 'cursor-not-allowed bg-(--bg-surface-active) text-(--text-ghost)',
          )}
        >
          {isSynthesizing && <Loader2 className="size-3 animate-spin" />}
          Synthesize
        </button>

        {synthesisError && <p className="text-xs text-red-400">{synthesisError}</p>}
      </div>

      {synthesisText && (
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-4">
          <p className="mb-3 text-xs font-medium text-(--text-muted)">
            Synthesis
            {selectedJudgeLabel && (
              <span className="ml-1 font-mono text-(--text-ghost)">via {selectedJudgeLabel}</span>
            )}
          </p>
          <div className="text-[0.90625rem] leading-[1.72] text-(--text-primary)">
            <MarkdownRenderer content={synthesisText} />
          </div>
        </div>
      )}
    </div>
  )
}
