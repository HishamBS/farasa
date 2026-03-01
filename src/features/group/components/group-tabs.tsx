'use client'

import { useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GroupResponsePanel } from './group-response-panel'
import { SynthesisPanel } from './synthesis-panel'
import { CHAT_STREAM_STATUS, PROVIDER_DOT_CLASSES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { extractProviderKey, extractModelName } from '@/lib/utils/model'
import type { StreamState } from '@/types/stream'
import type { UseSynthesisReturn } from '@/features/group/hooks/use-group-synthesis'

const SYNTHESIS_TAB_VALUE = 'synthesis'

type ModelMeta = {
  id: string
  name: string
  provider?: string
}

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
  modelId: string
  modelMeta: ModelMeta | undefined
  streamState: StreamState | undefined
}

function ModelTabTrigger({ modelId, modelMeta, streamState }: ModelTabTriggerProps) {
  const providerKey = useMemo(
    () => modelMeta?.provider ?? extractProviderKey(modelId),
    [modelMeta, modelId],
  )
  const label = useMemo(
    () => (modelMeta?.name ?? extractModelName(modelId)).split(/[\s-]/)[0] ?? modelId,
    [modelMeta, modelId],
  )
  const dotClass = PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-ghost)'
  const isStreaming = streamState?.phase === CHAT_STREAM_STATUS.ACTIVE

  return (
    <>
      <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
      <span className="max-w-20 truncate">{label}</span>
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

  const defaultTab = modelOrder[0] ?? SYNTHESIS_TAB_VALUE

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex-wrap">
        {modelOrder.map((modelId) => (
          <TabsTrigger key={modelId} value={modelId}>
            <ModelTabTrigger
              modelId={modelId}
              modelMeta={modelMetaMap.get(modelId)}
              streamState={modelStates.get(modelId)}
            />
          </TabsTrigger>
        ))}
        <TabsTrigger value={SYNTHESIS_TAB_VALUE} disabled={!groupDone}>
          Synthesis
        </TabsTrigger>
      </TabsList>

      {modelOrder.map((modelId) => {
        const modelMeta = modelMetaMap.get(modelId)
        const streamState = modelStates.get(modelId)
        const providerKey = modelMeta?.provider ?? extractProviderKey(modelId)
        const modelLabel = modelMeta?.name ?? extractModelName(modelId)

        return (
          <TabsContent key={modelId} value={modelId}>
            {streamState && (
              <GroupResponsePanel
                modelId={modelId}
                modelLabel={modelLabel}
                providerKey={providerKey}
                streamState={streamState}
              />
            )}
          </TabsContent>
        )
      })}

      <TabsContent value={SYNTHESIS_TAB_VALUE}>
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
