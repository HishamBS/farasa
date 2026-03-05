'use client'

import { UI_TEXT, UX } from '@/config/constants'
import { ModelSelector } from '@/features/chat/components/model-selector'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { useTeamMode } from '@/features/team/context/team-context'
import type { UseSynthesisReturn } from '@/features/team/hooks/use-team-synthesis'
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
  const policyQuery = trpc.team.policy.useQuery({ selectedModelIds: comparisonModelIds })
  const synthesisModelOptions = useMemo(
    () => policyQuery.data?.synthesisModelOptions ?? [],
    [policyQuery.data?.synthesisModelOptions],
  )
  const { data: allModels = [] } = trpc.model.list.useQuery()
  const { trigger, isSynthesizing, synthesisText, error: synthesisError } = synthesis

  const hasSelectedSynthesisModel = useMemo(
    () => synthesisModelOptions.some((model) => model.id === synthesisModel),
    [synthesisModelOptions, synthesisModel],
  )

  useEffect(() => {
    if (synthesisModel) return
    if (synthesisModelOptions.length === 0) return
    const firstOption = synthesisModelOptions[0]
    if (firstOption) setSynthesisModel(firstOption.id)
  }, [synthesisModelOptions, synthesisModel, setSynthesisModel])

  useEffect(() => {
    if (!synthesisModel) return
    if (policyQuery.isLoading) return
    if (hasSelectedSynthesisModel) return
    setSynthesisModel(undefined)
  }, [hasSelectedSynthesisModel, synthesisModel, setSynthesisModel, policyQuery.isLoading])

  const hasSelectableSynthesisModel = synthesisModelOptions.length > 0
  const effectiveSynthesisModel = hasSelectedSynthesisModel ? synthesisModel : undefined
  const canSynthesize =
    teamDone && hasSelectableSynthesisModel && !!effectiveSynthesisModel && !isSynthesizing
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

  const selectableSynthesisModelIds = useMemo(
    () => new Set(synthesisModelOptions.map((model) => model.id)),
    [synthesisModelOptions],
  )
  const excludedModelIds = useMemo(
    () =>
      allModels
        .filter((model) => !selectableSynthesisModelIds.has(model.id))
        .map((model) => model.id),
    [allModels, selectableSynthesisModelIds],
  )

  return (
    <div className="space-y-4 py-1">
      <div className="space-y-2">
        <p className="text-xs font-medium text-(--text-muted)">
          {UI_TEXT.TEAM_SYNTHESIZER_SELECT_ARIA_PREFIX} model
        </p>
        {hasSelectableSynthesisModel ? (
          <ModelSelector
            value={effectiveSynthesisModel}
            onChange={handleSynthesisModelChange}
            includeAuto={false}
            excludedModelIds={excludedModelIds}
            emptyLabel={UI_TEXT.TEAM_SYNTHESIZER_SELECT_ARIA_PREFIX}
            menuPlacement="auto"
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
          aria-label={UI_TEXT.TEAM_SYNTHESIZE_ARIA}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors${
            canSynthesize
              ? ' bg-(--accent) text-white hover:bg-(--accent-hover)'
              : ' cursor-not-allowed bg-(--bg-surface-active) text-(--text-ghost)'
          }`}
        >
          {isSynthesizing && <Loader2 className="size-3 animate-spin" />}
          Synthesize
        </button>

        {synthesisError && <p className="text-xs text-destructive">{synthesisError}</p>}
      </div>

      {displayedSynthesisText && (
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-4">
          <p className="mb-3 text-xs font-medium text-(--text-muted)">
            Synthesis
            {synthesisModelLabel && (
              <span className="ml-1 font-mono text-(--text-ghost)">via {synthesisModelLabel}</span>
            )}
          </p>
          <div className={UX.PROSE_BODY_CLASS}>
            <MarkdownRenderer content={displayedSynthesisText} />
          </div>
        </div>
      )}
    </div>
  )
}
