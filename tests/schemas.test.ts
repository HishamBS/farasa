import { describe, expect, test } from 'bun:test'
import { ChatInputSchema, StreamChunkSchema } from '@/schemas/message'
import { STREAM_EVENTS, STREAM_PHASES } from '@/config/constants'

describe('schema contracts', () => {
  test('accepts valid chat input', () => {
    const parsed = ChatInputSchema.parse({
      content: 'hello',
      mode: 'chat',
      attachmentIds: [],
      streamRequestId: crypto.randomUUID(),
      attempt: 0,
    })
    expect(parsed.content).toBe('hello')
  })

  test('accepts valid status stream chunk', () => {
    const parsed = StreamChunkSchema.parse({
      type: STREAM_EVENTS.STATUS,
      phase: STREAM_PHASES.THINKING,
      message: 'Thinking...',
      streamRequestId: crypto.randomUUID(),
      attempt: 0,
    })
    expect(parsed.type).toBe(STREAM_EVENTS.STATUS)
  })
})
