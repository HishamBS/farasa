'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CHAT_STREAM_STATUS,
  GROUP_TAB_VALUES,
  PROVIDER_ALIASES,
  PROVIDER_DOT_CLASSES,
} from '@/config/constants'
import type { UseSynthesisReturn } from '@/features/group/hooks/use-group-synthesis'
import type { ModelMeta } from '@/features/group/types'
import { cn } from '@/lib/utils/cn'
import { extractModelName, resolveProviderKey } from '@/lib/utils/model'
import type { StreamState } from '@/types/stream'
import { useMemo } from 'react'
import { GroupResponsePanel } from './group-response-panel'
import { SynthesisPanel } from './synthesis-panel'

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
  status: 'idle' | 'streaming' | 'done' | 'error'
}

function ModelTabTrigger({ providerKey, label, status }: ModelTabTriggerProps) {
  const dotClass = PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-muted)'
  const statusClass =
    status === 'error'
      ? 'bg-(--error)'
      : status === 'done'
        ? 'bg-(--success)'
        : status === 'streaming'
          ? 'animate-pulse bg-(--accent)'
          : 'bg-(--text-ghost)'
  const statusLabel =
    status === 'error'
      ? 'Error'
      : status === 'done'
        ? 'Complete'
        : status === 'streaming'
          ? 'Streaming'
          : 'Idle'

  return (
    <>
      <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
      <span className="max-w-40 truncate">{label}</span>
      <span
        className={cn('size-1.5 rounded-full', statusClass)}
        aria-label={`${label} status: ${statusLabel}`}
        title={statusLabel}
      />
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
        providerKey: meta?.provider ?? resolveProviderKey(modelId, PROVIDER_ALIASES),
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
          const status =
            streamState?.phase === CHAT_STREAM_STATUS.ERROR
              ? 'error'
              : streamState?.phase === CHAT_STREAM_STATUS.COMPLETE
                ? 'done'
                : streamState?.phase === CHAT_STREAM_STATUS.ACTIVE
                  ? 'streaming'
                  : 'idle'
          return (
            <TabsTrigger key={modelId} value={modelId}>
              <ModelTabTrigger
                providerKey={resolved?.providerKey ?? ''}
                label={resolved?.label ?? modelId}
                status={status}
              />
            </TabsTrigger>
          )
        })}
        <TabsTrigger value={GROUP_TAB_VALUES.SYNTHESIS} disabled={!groupDone}>
          Synthesis
        </TabsTrigger>
      </TabsList>
      <div className="mt-2 flex items-center gap-3 px-1 text-[0.6875rem] text-(--text-ghost)">
        <span>Left dot = provider</span>
        <span>Right dot = stream status</span>
      </div>

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
