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

  test('accepts user_message_saved stream chunk with attachments', () => {
    const parsed = StreamChunkSchema.parse({
      type: STREAM_EVENTS.USER_MESSAGE_SAVED,
      messageId: crypto.randomUUID(),
      attachments: [
        {
          id: crypto.randomUUID(),
          fileName: 'resume.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageUrl: 'data:application/pdf;base64,JVBERi0=',
        },
      ],
      streamRequestId: crypto.randomUUID(),
      attempt: 0,
    })
    expect(parsed.type).toBe(STREAM_EVENTS.USER_MESSAGE_SAVED)
  })
})
