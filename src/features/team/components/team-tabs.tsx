'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CHAT_STREAM_STATUS,
  PROVIDER_ALIASES,
  PROVIDER_DOT_CLASSES,
  TEAM_TAB_STATUS,
  TEAM_TAB_VALUES,
} from '@/config/constants'
import type { UseSynthesisReturn } from '@/features/team/hooks/use-team-synthesis'
import type { ModelMeta } from '@/features/team/types'
import { cn } from '@/lib/utils/cn'
import { extractModelName, resolveProviderKey } from '@/lib/utils/model'
import type { StreamState } from '@/types/stream'
import { useMemo } from 'react'
import { SynthesisPanel } from './synthesis-panel'
import { TeamResponsePanel } from './team-response-panel'

type TeamTabsProps = {
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  teamDone: boolean
  teamId: string | undefined
  conversationId: string
  synthesis: UseSynthesisReturn
  models: ModelMeta[]
}

type TeamTabStatusValue = (typeof TEAM_TAB_STATUS)[keyof typeof TEAM_TAB_STATUS]

type ModelTabTriggerProps = {
  providerKey: string
  label: string
  status: TeamTabStatusValue
}

function ModelTabTrigger({ providerKey, label, status }: ModelTabTriggerProps) {
  const dotClass = PROVIDER_DOT_CLASSES[providerKey] ?? 'bg-(--text-muted)'
  const statusClass =
    status === TEAM_TAB_STATUS.ERROR
      ? 'bg-(--error)'
      : status === TEAM_TAB_STATUS.DONE
        ? 'bg-(--success)'
        : status === TEAM_TAB_STATUS.STREAMING
          ? 'animate-pulse bg-(--accent)'
          : 'bg-(--text-ghost)'
  const statusLabel =
    status === TEAM_TAB_STATUS.ERROR
      ? 'Error'
      : status === TEAM_TAB_STATUS.DONE
        ? 'Complete'
        : status === TEAM_TAB_STATUS.STREAMING
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

export function TeamTabs({
  modelStates,
  modelOrder,
  teamDone,
  teamId,
  conversationId,
  synthesis,
  models,
}: TeamTabsProps) {
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

  const defaultTab = modelOrder[0] ?? TEAM_TAB_VALUES.SYNTHESIS
  const synthesisReady = useMemo(() => {
    if (teamDone) return true
    if (modelOrder.length === 0) return false
    return modelOrder.every((modelId) => {
      const phase = modelStates.get(modelId)?.phase
      return phase === CHAT_STREAM_STATUS.COMPLETE || phase === CHAT_STREAM_STATUS.ERROR
    })
  }, [modelOrder, modelStates, teamDone])

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex-wrap">
        {modelOrder.map((modelId) => {
          const resolved = resolvedMetaMap.get(modelId)
          const streamState = modelStates.get(modelId)
          const status: TeamTabStatusValue =
            streamState?.phase === CHAT_STREAM_STATUS.ERROR
              ? TEAM_TAB_STATUS.ERROR
              : streamState?.phase === CHAT_STREAM_STATUS.COMPLETE
                ? TEAM_TAB_STATUS.DONE
                : streamState?.phase === CHAT_STREAM_STATUS.ACTIVE
                  ? TEAM_TAB_STATUS.STREAMING
                  : TEAM_TAB_STATUS.IDLE
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
        <TabsTrigger value={TEAM_TAB_VALUES.SYNTHESIS}>Synthesis</TabsTrigger>
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
              <TeamResponsePanel
                modelLabel={resolved?.label ?? modelId}
                providerKey={resolved?.providerKey ?? ''}
                streamState={streamState}
              />
            )}
          </TabsContent>
        )
      })}

      <TabsContent value={TEAM_TAB_VALUES.SYNTHESIS}>
        {teamId && (
          <SynthesisPanel
            comparisonModelIds={modelOrder}
            conversationId={conversationId}
            teamId={teamId}
            teamDone={synthesisReady}
            synthesis={synthesis}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
