'use client'

import { useMemo } from 'react'
import { GroupTabs } from './group-tabs'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PROVIDER_DOT_CLASSES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { extractProviderKey, extractModelName } from '@/lib/utils/model'
import type { StreamState } from '@/types/stream'
import type { UseSynthesisReturn } from '@/features/group/hooks/use-group-synthesis'
import type { ModelMeta } from '@/features/group/types'

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
  conversationId: string
}

export type GroupMessageGroupProps = LiveGroupProps | HistoricalGroupProps

type HistoricalTabsProps = {
  messages: HistoricalMessage[]
}

function HistoricalTabs({ messages }: HistoricalTabsProps) {
  const defaultTab = messages[0]?.modelId ?? ''

  const tabMetas = useMemo(
    () =>
      messages.map((msg) => {
        const providerKey = extractProviderKey(msg.modelId)
        return {
          modelId: msg.modelId,
          providerKey,
          label: (msg.modelLabel ?? extractModelName(msg.modelId)).split(/[\s-]/)[0] ?? msg.modelId,
          dotClass: PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-ghost)',
          content: msg.content,
        }
      }),
    [messages],
  )

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex-wrap">
        {tabMetas.map(({ modelId, label, dotClass }) => (
          <TabsTrigger key={modelId} value={modelId}>
            <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
            <span className="max-w-20 truncate">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {tabMetas.map(({ modelId, content }) => (
        <TabsContent key={modelId} value={modelId}>
          <div className="py-1 text-[0.90625rem] leading-[1.72] text-(--text-primary)">
            <MarkdownRenderer content={content} />
          </div>
        </TabsContent>
      ))}
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

  if (props.historicalMessages.length > 0) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4">
        <HistoricalTabs messages={props.historicalMessages} />
      </div>
    )
  }

  return null
}
