import { TEAM_STREAM_PHASES } from '@/config/constants'
import type { TeamStreamPhase } from '@/features/team/types'

type LiveTeamVisibilityInput = {
  teamPhase: TeamStreamPhase
  teamPersisted: boolean
  hasPersistedTeamMessages: boolean
}

export function shouldRenderLiveTeam({
  teamPhase,
  teamPersisted,
  hasPersistedTeamMessages,
}: LiveTeamVisibilityInput): boolean {
  if (teamPhase === TEAM_STREAM_PHASES.ACTIVE) return true

  if (teamPhase === TEAM_STREAM_PHASES.DONE) {
    // Keep live output visible until persisted history is confirmed in message query data.
    return !teamPersisted || !hasPersistedTeamMessages
  }

  return false
}
