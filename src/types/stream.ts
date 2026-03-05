import type { CHAT_STREAM_STATUS, STREAM_ACTIONS, TITLEBAR_PHASE } from '@/config/constants'
import type { ChatInput, StreamPhase } from '@/schemas'
import type {
  ModelCapability,
  ModelResponseFormat,
  ModelSelectionSource,
  RouterFactor,
} from '@/schemas/model'
import type { v0_8 } from '@a2ui-sdk/types'

export type ChatStreamStatus = (typeof CHAT_STREAM_STATUS)[keyof typeof CHAT_STREAM_STATUS]

export type StatusMessage = {
  phase: StreamPhase
  message: string
  completedAt?: number
}

export type ThinkingState = {
  content: string
  startedAt: number
  completedAt?: number
}

export type ModelSelectionState = {
  model: string
  reasoning: string
  source: ModelSelectionSource
  category?: ModelCapability
  responseFormat?: ModelResponseFormat
  confidence?: number
  factors?: RouterFactor[]
}

export type ToolExecutionState = {
  name: string
  input: unknown
  result?: unknown
  completedAt?: number
}

export type StreamState = {
  phase: ChatStreamStatus
  statusMessages: StatusMessage[]
  thinking: ThinkingState | null
  modelSelection: ModelSelectionState | null
  toolExecutions: ToolExecutionState[]
  textContent: string
  a2uiMessages: v0_8.A2UIMessage[]
  error: {
    message: string
    code?: string
    reasonCode?: string
    recoverable?: boolean
    attempt?: number
  } | null
  lastInput: ChatInput | null
  detectedSearchMode: boolean
  pendingUserMessage: string | null
  pendingClientRequestId: string | null
  resolvedConversationId: string | null
}

export type StreamAction =
  | { type: typeof STREAM_ACTIONS.STATUS; phase: StreamPhase; message: string }
  | {
      type: typeof STREAM_ACTIONS.MODEL_SELECTED
      model: string
      reasoning: string
      source: ModelSelectionSource
      category?: ModelCapability
      responseFormat?: ModelResponseFormat
      confidence?: number
      factors?: RouterFactor[]
    }
  | { type: typeof STREAM_ACTIONS.THINKING_CHUNK; content: string; isComplete: boolean }
  | { type: typeof STREAM_ACTIONS.TOOL_START; name: string; input: unknown }
  | { type: typeof STREAM_ACTIONS.TOOL_RESULT; name: string; result: unknown }
  | { type: typeof STREAM_ACTIONS.TEXT_CHUNK; content: string }
  | { type: typeof STREAM_ACTIONS.TEXT_SET; content: string }
  | { type: typeof STREAM_ACTIONS.A2UI_MESSAGE; message: v0_8.A2UIMessage }
  | {
      type: typeof STREAM_ACTIONS.ERROR
      error: {
        message: string
        code?: string
        reasonCode?: string
        recoverable?: boolean
        attempt?: number
      }
    }
  | { type: typeof STREAM_ACTIONS.DONE }
  | { type: typeof STREAM_ACTIONS.RESET }
  | { type: typeof STREAM_ACTIONS.SAVE_INPUT; input: ChatInput }
  | { type: typeof STREAM_ACTIONS.SET_CONVERSATION_ID; conversationId: string | null }
  | { type: typeof STREAM_ACTIONS.CLEAR_PENDING_USER_MESSAGE }
  | { type: typeof STREAM_ACTIONS.BEGIN }

export type TitlebarPhase = (typeof TITLEBAR_PHASE)[keyof typeof TITLEBAR_PHASE]
