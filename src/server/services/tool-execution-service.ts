import { MESSAGE_ROLES } from '@/config/constants'
import { AppError } from '@/lib/utils/errors'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import type { SearchImage, SearchResult } from '@/schemas/search'
import { executeSearchEnrichment } from '@/server/services/search-enrichment-service'
import {
  mergeSearchImages,
  mergeSearchResults,
  parseSearchToolQuery,
} from '@/server/services/search-tool-service'
import type { ChatMessageToolCall } from '@openrouter/sdk/models'

type ToolCallDelta = { id?: string; name?: string; argsJson: string }

type SearchEnrichmentResult = {
  query: string
  results: SearchResult[]
  images: SearchImage[]
}

export function accumulateToolCallDelta(
  deltas: Map<number, ToolCallDelta>,
  toolCallDelta: {
    index: number
    id?: string
    function?: { name?: string; arguments?: string }
  },
): void {
  const current = deltas.get(toolCallDelta.index) ?? { argsJson: '' }
  if (toolCallDelta.id) current.id = toolCallDelta.id
  if (toolCallDelta.function?.name) current.name = toolCallDelta.function.name
  if (toolCallDelta.function?.arguments) current.argsJson += toolCallDelta.function.arguments
  deltas.set(toolCallDelta.index, current)
}

export function buildRoundToolCalls(deltas: Map<number, ToolCallDelta>): ChatMessageToolCall[] {
  return [...deltas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, value]) => ({
      id: value.id ?? `tool_${index}_${crypto.randomUUID()}`,
      type: 'function' as const,
      function: { name: value.name ?? '', arguments: value.argsJson },
    }))
    .filter((call) => call.function.name.length > 0)
}

export async function executeSearchToolCall(params: {
  call: ChatMessageToolCall
  searchToolName: string
  fallbackQuery: string
  runtimeConfig: RuntimeConfig
  existingResults: SearchResult[]
  existingImages: SearchImage[]
}): Promise<{
  toolCallEntry: {
    name: string
    input: { query: string }
    result: SearchEnrichmentResult
    durationMs: number
  }
  toolMessage: { role: typeof MESSAGE_ROLES.TOOL; toolCallId: string; content: string }
  mergedResults: SearchResult[]
  mergedImages: SearchImage[]
}> {
  const toolQuery = parseSearchToolQuery(params.call.function.arguments, params.fallbackQuery)
  const startedAt = Date.now()
  const enrichment = await executeSearchEnrichment(toolQuery, params.runtimeConfig)

  const result: SearchEnrichmentResult = {
    query: enrichment.query,
    results: enrichment.results,
    images: enrichment.images,
  }

  return {
    toolCallEntry: {
      name: params.searchToolName,
      input: { query: toolQuery },
      result,
      durationMs: Date.now() - startedAt,
    },
    toolMessage: {
      role: MESSAGE_ROLES.TOOL,
      toolCallId: params.call.id,
      content: JSON.stringify(result),
    },
    mergedResults: mergeSearchResults(params.existingResults, enrichment.results),
    mergedImages: mergeSearchImages(params.existingImages, enrichment.images),
  }
}

export function buildUnsupportedToolResponse(call: ChatMessageToolCall): {
  role: typeof MESSAGE_ROLES.TOOL
  toolCallId: string
  content: string
} {
  return {
    role: MESSAGE_ROLES.TOOL,
    toolCallId: call.id,
    content: JSON.stringify({ error: AppError.UNSUPPORTED_TOOL_CALL }),
  }
}
