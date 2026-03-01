'use client'

import { useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GroupResponsePanel } from './group-response-panel'
import { SynthesisPanel } from './synthesis-panel'
import { CHAT_STREAM_STATUS, GROUP_TAB_VALUES, PROVIDER_DOT_CLASSES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { extractProviderKey, extractModelName } from '@/lib/utils/model'
import type { StreamState } from '@/types/stream'
import type { UseSynthesisReturn } from '@/features/group/hooks/use-group-synthesis'
import type { ModelMeta } from '@/features/group/types'

type GroupTabsProps = {
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  groupDone: boolean
  groupId: string | undefined
  conversationId: string
  synthesis: UseSynthesisReturn
  models: ModelMeta[]
}

type ModelTabTriggerProps = {
  providerKey: string
  label: string
  isStreaming: boolean
}

function ModelTabTrigger({ providerKey, label, isStreaming }: ModelTabTriggerProps) {
  const shortLabel = label.split(/[\s-]/)[0] ?? label
  const dotClass = PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-ghost)'

  return (
    <>
      <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
      <span className="max-w-20 truncate">{shortLabel}</span>
      {isStreaming && <span className="size-1.5 animate-pulse rounded-full bg-(--accent)" />}
    </>
  )
}

export function GroupTabs({
  modelStates,
  modelOrder,
  groupDone,
  groupId,
  conversationId,
  synthesis,
  models,
}: GroupTabsProps) {
  const modelMetaMap = useMemo(() => {
    const map = new Map<string, ModelMeta>()
    for (const m of models) {
      map.set(m.id, m)
    }
    return map
  }, [models])

  const resolvedMetaMap = useMemo(() => {
    const map = new Map<string, { providerKey: string; label: string }>()
    for (const modelId of modelOrder) {
      const meta = modelMetaMap.get(modelId)
      map.set(modelId, {
        providerKey: meta?.provider ?? extractProviderKey(modelId),
        label: meta?.name ?? extractModelName(modelId),
      })
    }
    return map
  }, [modelMetaMap, modelOrder])

  const defaultTab = modelOrder[0] ?? GROUP_TAB_VALUES.SYNTHESIS

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex-wrap">
        {modelOrder.map((modelId) => {
          const resolved = resolvedMetaMap.get(modelId)
          const streamState = modelStates.get(modelId)
          return (
            <TabsTrigger key={modelId} value={modelId}>
              <ModelTabTrigger
                providerKey={resolved?.providerKey ?? ''}
                label={resolved?.label ?? modelId}
                isStreaming={streamState?.phase === CHAT_STREAM_STATUS.ACTIVE}
              />
            </TabsTrigger>
          )
        })}
        <TabsTrigger value={GROUP_TAB_VALUES.SYNTHESIS} disabled={!groupDone}>
          Synthesis
        </TabsTrigger>
      </TabsList>

      {modelOrder.map((modelId) => {
        const resolved = resolvedMetaMap.get(modelId)
        const streamState = modelStates.get(modelId)
        return (
          <TabsContent key={modelId} value={modelId}>
            {streamState && (
              <GroupResponsePanel
                modelLabel={resolved?.label ?? modelId}
                providerKey={resolved?.providerKey ?? ''}
                streamState={streamState}
              />
            )}
          </TabsContent>
        )
      })}

      <TabsContent value={GROUP_TAB_VALUES.SYNTHESIS}>
        {groupDone && groupId && (
          <SynthesisPanel
            comparisonModelIds={modelOrder}
            conversationId={conversationId}
            groupId={groupId}
            groupDone={groupDone}
            synthesis={synthesis}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
