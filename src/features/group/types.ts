import type { StreamState } from '@/types/stream'

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
