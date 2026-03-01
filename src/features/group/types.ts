import type { StreamState } from '@/types/stream'

export type GroupModelState = {
  modelId: string
  modelIndex: number
  streamState: StreamState
}

export type GroupStreamPhase = 'idle' | 'active' | 'done' | 'error'
