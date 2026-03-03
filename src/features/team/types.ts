import { TEAM_STREAM_PHASES } from '@/config/constants'
import type { StreamState } from '@/types/stream'
import type { UseSynthesisReturn } from '@/features/team/hooks/use-team-synthesis'

export type ModelMeta = {
  id: string
  name: string
  provider?: string
}

export type TeamModelState = {
  modelId: string
  modelIndex: number
  streamState: StreamState
}

export type TeamStreamPhase = (typeof TEAM_STREAM_PHASES)[keyof typeof TEAM_STREAM_PHASES]

export type LiveTeamData = {
  modelStates: Map<string, StreamState>
  modelOrder: string[]
  teamDone: boolean
  teamId: string | undefined
  conversationId: string
  synthesis: UseSynthesisReturn
  models: ModelMeta[]
}
