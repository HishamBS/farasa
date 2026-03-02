import { GROUP_STREAM_PHASES } from '@/config/constants'
import type { StreamState } from '@/types/stream'
import type { UseSynthesisReturn } from '@/features/group/hooks/use-group-synthesis'

export type ModelMeta = {
  id: string
  name: string
  provider?: string
}

export type GroupModelState = {
  modelId: string
  modelIndex: number
  streamState: StreamState
}

export type GroupStreamPhase = (typeof GROUP_STREAM_PHASES)[keyof typeof GROUP_STREAM_PHASES]

export type LiveGroupData = {
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  groupDone: boolean
  groupId: string | undefined
  conversationId: string
  synthesis: UseSynthesisReturn
  models: ModelMeta[]
}
