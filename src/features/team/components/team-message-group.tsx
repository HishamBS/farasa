'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TEAM_TAB_VALUES, PROVIDER_ALIASES, PROVIDER_DOT_CLASSES, UX } from '@/config/constants'
import type { UseSynthesisReturn } from '@/features/team/hooks/use-team-synthesis'
import { useTeamSynthesis } from '@/features/team/hooks/use-team-synthesis'
import type { ModelMeta } from '@/features/team/types'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { cn } from '@/lib/utils/cn'
import { extractModelName, resolveProviderKey } from '@/lib/utils/model'
import type { StreamState } from '@/types/stream'
import { useMemo } from 'react'
import { TeamTabs } from './team-tabs'
import { SynthesisPanel } from './synthesis-panel'

type HistoricalMessage = {
  modelId: string
  content: string
  modelLabel?: string
}

type LiveTeamProps = {
  mode: 'live'
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  teamDone: boolean
  teamId?: string
  conversationId: string
  synthesis: UseSynthesisReturn
  models: ModelMeta[]
}

type HistoricalTeamProps = {
  mode: 'historical'
  historicalMessages: HistoricalMessage[]
  synthesisText?: string
  synthesisModelId?: string
  teamId: string
  conversationId: string
}

export type TeamMessageGroupProps = LiveTeamProps | HistoricalTeamProps

type HistoricalTabsProps = {
  messages: HistoricalMessage[]
  synthesisText?: string
  synthesisModelId?: string
  teamId: string
  conversationId: string
}

function HistoricalTabs({
  messages,
  synthesisText,
  synthesisModelId,
  teamId,
  conversationId,
}: HistoricalTabsProps) {
  const synthesis = useTeamSynthesis()
  const defaultTab = messages[0]?.modelId ?? TEAM_TAB_VALUES.SYNTHESIS

  const tabMetas = useMemo(
    () =>
      messages.map((msg) => {
        const providerKey = resolveProviderKey(msg.modelId, PROVIDER_ALIASES)
        return {
          modelId: msg.modelId,
          providerKey,
          label: msg.modelLabel ?? extractModelName(msg.modelId),
          dotClass: PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-muted)',
          content: msg.content,
        }
      }),
    [messages],
  )
  const comparisonModelIds = useMemo(() => tabMetas.map((tab) => tab.modelId), [tabMetas])

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex-wrap">
        {tabMetas.map(({ modelId, label, dotClass }) => (
          <TabsTrigger key={modelId} value={modelId}>
            <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
            <span className="max-w-40 truncate">{label}</span>
          </TabsTrigger>
        ))}
        <TabsTrigger value={TEAM_TAB_VALUES.SYNTHESIS}>Synthesis</TabsTrigger>
      </TabsList>

      {tabMetas.map(({ modelId, content }) => (
        <TabsContent key={modelId} value={modelId}>
          <div className={cn('py-1', UX.PROSE_BODY_CLASS)}>
            <MarkdownRenderer content={content} />
          </div>
        </TabsContent>
      ))}

      <TabsContent value={TEAM_TAB_VALUES.SYNTHESIS}>
        <SynthesisPanel
          comparisonModelIds={comparisonModelIds}
          conversationId={conversationId}
          teamId={teamId}
          teamDone
          synthesis={synthesis}
          initialSynthesisText={synthesisText}
          initialSynthesisModelId={synthesisModelId}
        />
      </TabsContent>
    </Tabs>
  )
}

export function TeamMessageGroup(props: TeamMessageGroupProps) {
  if (props.mode === 'live') {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4">
        <TeamTabs
          modelStates={props.modelStates}
          modelOrder={props.modelOrder}
          teamDone={props.teamDone}
          teamId={props.teamId}
          conversationId={props.conversationId}
          synthesis={props.synthesis}
          models={props.models}
        />
      </div>
    )
  }

  if (props.historicalMessages.length > 0 || props.synthesisText) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4">
        <HistoricalTabs
          messages={props.historicalMessages}
          synthesisText={props.synthesisText}
          synthesisModelId={props.synthesisModelId}
          teamId={props.teamId}
          conversationId={props.conversationId}
        />
      </div>
    )
  }

  return null
}
