import type { ToolDefinitionJson } from '@openrouter/sdk/models'
import { TOOL_NAMES } from '@/config/constants'

export const WEB_SEARCH_TOOL: ToolDefinitionJson = {
  type: 'function',
  function: {
    name: TOOL_NAMES.WEB_SEARCH,
    description:
      'Search the web for up-to-date information. Use when the user asks about recent events, current data, or information that may have changed.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to execute',
        },
      },
      required: ['query'],
    },
  },
}

export const ALL_TOOLS: ToolDefinitionJson[] = [WEB_SEARCH_TOOL]
