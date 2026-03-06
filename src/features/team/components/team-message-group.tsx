'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TEAM_TAB_VALUES, PROVIDER_ALIASES, PROVIDER_DOT_CLASSES, UX } from '@/config/constants'
import { buildToolExecutions } from '@/features/chat/utils/build-tool-executions'
import type { UseSynthesisReturn } from '@/features/team/hooks/use-team-synthesis'
import { useTeamSynthesis } from '@/features/team/hooks/use-team-synthesis'
import type { ModelMeta } from '@/features/team/types'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { cn } from '@/lib/utils/cn'
import { extractModelName, resolveProviderKey } from '@/lib/utils/model'
import type { MessageMetadata } from '@/schemas/message'
import { MessageMetadataSchema } from '@/schemas/message'
import type { StreamState, ToolExecutionState } from '@/types/stream'
import { useMemo } from 'react'
import { TeamTabs } from './team-tabs'
import { SynthesisPanel } from './synthesis-panel'

type HistoricalMessage = {
  modelId: string
  content: string
  modelLabel?: string
  metadata?: MessageMetadata | null
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
  teamToolExecutions?: ToolExecutionState[]
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
        const parsedMeta = msg.metadata ? MessageMetadataSchema.safeParse(msg.metadata) : null
        const validMeta = parsedMeta?.success ? parsedMeta.data : null
        return {
          modelId: msg.modelId,
          providerKey,
          label: msg.modelLabel ?? extractModelName(msg.modelId),
          dotClass: PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-muted)',
          content: msg.content,
          toolExecutions: validMeta ? buildToolExecutions(validMeta) : [],
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

      {tabMetas.map(({ modelId, content, toolExecutions }) => (
        <TabsContent key={modelId} value={modelId}>
          <div className={cn('py-1', UX.PROSE_BODY_CLASS)}>
            {toolExecutions.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {toolExecutions.map((execution, index) => (
                  <ToolExecution key={`${execution.name}-${index}`} execution={execution} />
                ))}
              </div>
            )}
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
          teamToolExecutions={props.teamToolExecutions}
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
