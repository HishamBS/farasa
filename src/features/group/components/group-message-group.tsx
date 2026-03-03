'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GROUP_TAB_VALUES, PROVIDER_ALIASES, PROVIDER_DOT_CLASSES } from '@/config/constants'
import type { UseSynthesisReturn } from '@/features/group/hooks/use-group-synthesis'
import { useGroupSynthesis } from '@/features/group/hooks/use-group-synthesis'
import type { ModelMeta } from '@/features/group/types'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { cn } from '@/lib/utils/cn'
import { extractModelName, resolveProviderKey } from '@/lib/utils/model'
import type { StreamState } from '@/types/stream'
import { useMemo } from 'react'
import { GroupTabs } from './group-tabs'
import { SynthesisPanel } from './synthesis-panel'

type HistoricalMessage = {
  modelId: string
  content: string
  modelLabel?: string
}

type LiveGroupProps = {
  mode: 'live'
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  groupDone: boolean
  groupId?: string
  conversationId: string
  synthesis: UseSynthesisReturn
  models: ModelMeta[]
}

type HistoricalGroupProps = {
  mode: 'historical'
  historicalMessages: HistoricalMessage[]
  synthesisText?: string
  synthesisModelId?: string
  groupId: string
  conversationId: string
}

export type GroupMessageGroupProps = LiveGroupProps | HistoricalGroupProps

type HistoricalTabsProps = {
  messages: HistoricalMessage[]
  synthesisText?: string
  synthesisModelId?: string
  groupId: string
  conversationId: string
}

function HistoricalTabs({
  messages,
  synthesisText,
  synthesisModelId,
  groupId,
  conversationId,
}: HistoricalTabsProps) {
  const synthesis = useGroupSynthesis()
  const defaultTab = messages[0]?.modelId ?? GROUP_TAB_VALUES.SYNTHESIS

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
        <TabsTrigger value={GROUP_TAB_VALUES.SYNTHESIS}>Synthesis</TabsTrigger>
      </TabsList>

      {tabMetas.map(({ modelId, content }) => (
        <TabsContent key={modelId} value={modelId}>
          <div className="py-1 text-[0.90625rem] leading-[1.72] text-(--text-primary)">
            <MarkdownRenderer content={content} />
          </div>
        </TabsContent>
      ))}

      <TabsContent value={GROUP_TAB_VALUES.SYNTHESIS}>
        <SynthesisPanel
          comparisonModelIds={comparisonModelIds}
          conversationId={conversationId}
          groupId={groupId}
          groupDone
          synthesis={synthesis}
          initialSynthesisText={synthesisText}
          initialSynthesisModelId={synthesisModelId}
        />
      </TabsContent>
    </Tabs>
  )
}

export function GroupMessageGroup(props: GroupMessageGroupProps) {
  if (props.mode === 'live') {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4">
        <GroupTabs
          modelStates={props.modelStates}
          modelOrder={props.modelOrder}
          groupDone={props.groupDone}
          groupId={props.groupId}
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
          groupId={props.groupId}
          conversationId={props.conversationId}
        />
      </div>
    )
  }

  return null
}
