'use client'

import { ModelSelector } from '@/features/chat/components/model-selector'
import { useTeamMode } from '@/features/team/context/team-context'
import type { UseSynthesisReturn } from '@/features/team/hooks/use-team-synthesis'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { extractModelName } from '@/lib/utils/model'
import { trpc } from '@/trpc/provider'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'

type SynthesisPanelProps = {
  comparisonModelIds: string[]
  conversationId: string
  teamId: string
  teamDone: boolean
  synthesis: UseSynthesisReturn
  initialSynthesisText?: string
  initialSynthesisModelId?: string
}

export function SynthesisPanel({
  comparisonModelIds,
  conversationId,
  teamId,
  teamDone,
  synthesis,
  initialSynthesisText,
  initialSynthesisModelId,
}: SynthesisPanelProps) {
  const { synthesisModel, setSynthesisModel } = useTeamMode()
  const { data: modelList = [] } = trpc.model.list.useQuery()
  const { trigger, isSynthesizing, synthesisText, error: synthesisError } = synthesis

  const availableSynthesisModels = useMemo(() => {
    const selectedComparisonModels = new Set(comparisonModelIds)
    return modelList.filter((model) => !selectedComparisonModels.has(model.id))
  }, [comparisonModelIds, modelList])

  const hasSelectedSynthesisModel = useMemo(
    () => availableSynthesisModels.some((model) => model.id === synthesisModel),
    [availableSynthesisModels, synthesisModel],
  )

  useEffect(() => {
    if (!synthesisModel) return
    if (hasSelectedSynthesisModel) return
    setSynthesisModel(undefined)
  }, [hasSelectedSynthesisModel, synthesisModel, setSynthesisModel])

  const effectiveSynthesisModel = hasSelectedSynthesisModel ? synthesisModel : undefined
  const canSynthesize = teamDone && !!effectiveSynthesisModel && !isSynthesizing
  const displayedSynthesisText = synthesisText || initialSynthesisText || ''

  const handleSynthesisModelChange = useCallback(
    (modelId: string | undefined) => {
      setSynthesisModel(modelId)
    },
    [setSynthesisModel],
  )

  const handleSynthesize = useCallback(() => {
    if (!canSynthesize || !effectiveSynthesisModel) return
    trigger({ teamId, conversationId, synthesisModel: effectiveSynthesisModel })
  }, [canSynthesize, effectiveSynthesisModel, trigger, teamId, conversationId])

  const selectedSynthesisLabel = useMemo(() => {
    if (!effectiveSynthesisModel) return null
    return extractModelName(effectiveSynthesisModel)
  }, [effectiveSynthesisModel])

  const synthesisModelLabel = useMemo(() => {
    if (synthesisText && selectedSynthesisLabel) return selectedSynthesisLabel
    if (initialSynthesisModelId) return extractModelName(initialSynthesisModelId)
    return selectedSynthesisLabel
  }, [initialSynthesisModelId, selectedSynthesisLabel, synthesisText])

  const hasSelectableSynthesisModel = availableSynthesisModels.length > 0

  return (
    <div className="space-y-4 py-1">
      <div className="space-y-2">
        <p className="text-xs font-medium text-(--text-muted)">Select synthesizer model</p>
        {hasSelectableSynthesisModel ? (
          <ModelSelector
            value={effectiveSynthesisModel}
            onChange={handleSynthesisModelChange}
            includeAuto={false}
            excludedModelIds={comparisonModelIds}
            emptyLabel="Select synthesizer"
          />
        ) : (
          <p className="text-xs text-(--text-ghost)">
            No additional synthesizer model available outside selected team models.
          </p>
        )}
        {selectedSynthesisLabel && (
          <p className="text-xs text-(--text-ghost)">
            Synthesizer:{' '}
            <span className="font-mono text-(--text-muted)">{selectedSynthesisLabel}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSynthesize}
          disabled={!canSynthesize}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors${
            canSynthesize
              ? ' bg-(--accent) text-white hover:bg-(--accent-hover)'
              : ' cursor-not-allowed bg-(--bg-surface-active) text-(--text-ghost)'
          }`}
        >
          {isSynthesizing && <Loader2 className="size-3 animate-spin" />}
          Synthesize
        </button>

        {synthesisError && <p className="text-xs text-red-400">{synthesisError}</p>}
      </div>

      {displayedSynthesisText && (
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-4">
          <p className="mb-3 text-xs font-medium text-(--text-muted)">
            Synthesis
            {synthesisModelLabel && (
              <span className="ml-1 font-mono text-(--text-ghost)">via {synthesisModelLabel}</span>
            )}
          </p>
          <div className="text-[0.90625rem] leading-[1.72] text-(--text-primary)">
            <MarkdownRenderer content={displayedSynthesisText} />
          </div>
        </div>
      )}
    </div>
  )
}
