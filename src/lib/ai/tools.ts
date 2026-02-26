import type { ChatCompletionTool } from 'openai/resources'
import { TOOL_NAMES } from '@/config/constants'

export const WEB_SEARCH_TOOL: ChatCompletionTool = {
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

export const ALL_TOOLS: ChatCompletionTool[] = [WEB_SEARCH_TOOL]
