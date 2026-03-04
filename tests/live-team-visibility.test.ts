import { TEAM_STREAM_PHASES } from '@/config/constants'
import { describe, expect, it } from 'bun:test'
import { shouldRenderLiveTeam } from '@/features/team/utils/live-team-visibility'

describe('shouldRenderLiveTeam', () => {
  it('keeps live team visible while active', () => {
    expect(
      shouldRenderLiveTeam({
        teamPhase: TEAM_STREAM_PHASES.ACTIVE,
        teamPersisted: false,
        hasPersistedTeamMessages: false,
      }),
    ).toBe(true)
  })

  it('keeps live team visible after done until persisted messages are present', () => {
    expect(
      shouldRenderLiveTeam({
        teamPhase: TEAM_STREAM_PHASES.DONE,
        teamPersisted: true,
        hasPersistedTeamMessages: false,
      }),
    ).toBe(true)
  })

  it('hides live team after done once persisted messages are available', () => {
    expect(
      shouldRenderLiveTeam({
        teamPhase: TEAM_STREAM_PHASES.DONE,
        teamPersisted: true,
        hasPersistedTeamMessages: true,
      }),
    ).toBe(false)
  })

  it('hides live team when stream is idle', () => {
    expect(
      shouldRenderLiveTeam({
        teamPhase: TEAM_STREAM_PHASES.IDLE,
        teamPersisted: false,
        hasPersistedTeamMessages: false,
      }),
    ).toBe(false)
  })
})
