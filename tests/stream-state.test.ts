import { describe, expect, test } from 'bun:test'
import {
  streamStateReducer,
  initialStreamState,
} from '@/features/stream-phases/hooks/use-stream-state'
import { STREAM_ACTIONS, CHAT_STREAM_STATUS } from '@/config/constants'

describe('STREAM_ACTIONS.RESET', () => {
  test('should preserve pendingUserMessage when resetting stream state', () => {
    const stateWithMessage = { ...initialStreamState, pendingUserMessage: 'hello world' }
    const result = streamStateReducer(stateWithMessage, { type: STREAM_ACTIONS.RESET })
    expect(result.pendingUserMessage).toBe('hello world')
  })

  test('should still reset phase back to initial', () => {
    const result = streamStateReducer(
      { ...initialStreamState, phase: CHAT_STREAM_STATUS.ACTIVE, pendingUserMessage: 'x' },
      { type: STREAM_ACTIONS.RESET },
    )
    expect(result.phase).toBe(initialStreamState.phase)
  })
})
