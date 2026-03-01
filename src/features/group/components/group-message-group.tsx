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

type ModelMeta = {
  id: string
  name: string
  provider?: string
}

type HistoricalMessage = {
  modelId: string
  content: string
  modelLabel?: string
}

type GroupMessageGroupProps = {
  modelStates?: Map<string, StreamState>
  modelOrder?: string[]
  groupDone?: boolean
  groupId?: string
  conversationId: string
  synthesis?: UseSynthesisReturn
  models?: ModelMeta[]
  historicalMessages?: HistoricalMessage[]
}

type HistoricalTabsProps = {
  messages: HistoricalMessage[]
}

function HistoricalTabs({ messages }: HistoricalTabsProps) {
  const defaultTab = messages[0]?.modelId ?? ''

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex-wrap">
        {messages.map((msg) => {
          const providerKey = extractProviderKey(msg.modelId)
          const label =
            (msg.modelLabel ?? extractModelName(msg.modelId)).split(/[\s-]/)[0] ?? msg.modelId
          const dotClass = PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-ghost)'
          return (
            <TabsTrigger key={msg.modelId} value={msg.modelId}>
              <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
              <span className="max-w-20 truncate">{label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>

      {messages.map((msg) => (
        <TabsContent key={msg.modelId} value={msg.modelId}>
          <div className="py-1 text-[0.90625rem] leading-[1.72] text-(--text-primary)">
            <MarkdownRenderer content={msg.content} />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

function LiveGroupTabs({
  modelStates,
  modelOrder,
  groupDone,
  groupId,
  conversationId,
  synthesis,
  models,
}: Required<
  Pick<
    GroupMessageGroupProps,
    'modelStates' | 'modelOrder' | 'groupDone' | 'conversationId' | 'synthesis' | 'models'
  >
> & { groupId: string | undefined }) {
  const nonEmptySynthesis = useMemo(() => synthesis, [synthesis])

  return (
    <GroupTabs
      modelStates={modelStates}
      modelOrder={modelOrder}
      groupDone={groupDone}
      groupId={groupId}
      conversationId={conversationId}
      synthesis={nonEmptySynthesis}
      models={models}
    />
  )
}

export function GroupMessageGroup({
  modelStates,
  modelOrder,
  groupDone,
  groupId,
  conversationId,
  synthesis,
  models,
  historicalMessages,
}: GroupMessageGroupProps) {
  const isLiveMode =
    modelStates !== undefined &&
    modelOrder !== undefined &&
    groupDone !== undefined &&
    synthesis !== undefined &&
    models !== undefined

  if (isLiveMode) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4">
        <LiveGroupTabs
          modelStates={modelStates}
          modelOrder={modelOrder}
          groupDone={groupDone}
          groupId={groupId}
          conversationId={conversationId}
          synthesis={synthesis}
          models={models}
        />
      </div>
    )
  }

  if (historicalMessages && historicalMessages.length > 0) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-surface) p-4">
        <HistoricalTabs messages={historicalMessages} />
      </div>
    )
  }

  return null
}
