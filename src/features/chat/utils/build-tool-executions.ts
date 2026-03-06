import { TOOL_NAMES } from '@/config/constants'
import type { MessageMetadata } from '@/schemas/message'
import type { ToolExecutionState } from '@/types/stream'

export function buildToolExecutions(metadata: MessageMetadata): ToolExecutionState[] {
  if (metadata.toolCalls && metadata.toolCalls.length > 0) {
    return metadata.toolCalls.map((toolCall, index) => ({
      name: toolCall.name,
      input: toolCall.input,
      result: toolCall.result,
      completedAt: index + 1,
    }))
  }

  if (
    (!metadata.searchResults || metadata.searchResults.length === 0) &&
    (!metadata.searchImages || metadata.searchImages.length === 0)
  ) {
    return []
  }

  return [
    {
      name: TOOL_NAMES.WEB_SEARCH,
      input: { query: metadata.searchQuery ?? '' },
      result: {
        query: metadata.searchQuery ?? '',
        results: metadata.searchResults ?? [],
        images: metadata.searchImages ?? [],
      },
      completedAt: 1,
    },
  ]
}
