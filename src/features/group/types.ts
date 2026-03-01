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

export type GroupStreamPhase = 'idle' | 'active' | 'done' | 'error'

export type LiveGroupData = {
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  groupDone: boolean
  groupId: string | undefined
  conversationId: string
  synthesis: UseSynthesisReturn
  models: ModelMeta[]
}
