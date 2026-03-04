import { describe, expect, it } from 'bun:test'
import { shouldReplaceConversationRoute } from '@/features/chat/utils/conversation-route'

describe('shouldReplaceConversationRoute', () => {
  const conversationId = '123e4567-e89b-12d3-a456-426614174000'

  it('returns false when pending conversation id is missing', () => {
    expect(
      shouldReplaceConversationRoute({
        currentPathname: '/chat',
        pendingConversationId: undefined,
      }),
    ).toBe(false)
  })

  it('returns false when pathname already matches target conversation path', () => {
    expect(
      shouldReplaceConversationRoute({
        currentPathname: `/chat/${conversationId}`,
        pendingConversationId: conversationId,
      }),
    ).toBe(false)
  })

  it('returns true when pathname differs from target conversation path', () => {
    expect(
      shouldReplaceConversationRoute({
        currentPathname: '/chat',
        pendingConversationId: conversationId,
      }),
    ).toBe(true)
  })
})
