import type { v0_8 } from '@a2ui-sdk/types'
import type { CHAT_STREAM_STATUS, STREAM_ACTIONS, TITLEBAR_PHASE } from '@/config/constants'
import type { StreamPhase, ChatInput } from '@/schemas'

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
  resolvedConversationId: string | null
}

export type StreamAction =
  | { type: 'STATUS'; phase: StreamPhase; message: string }
  | { type: 'MODEL_SELECTED'; model: string; reasoning: string }
  | { type: 'THINKING_CHUNK'; content: string; isComplete: boolean }
  | { type: 'TOOL_START'; name: string; input: unknown }
  | { type: 'TOOL_RESULT'; name: string; result: unknown }
  | { type: 'TEXT_CHUNK'; content: string }
  | { type: 'A2UI_MESSAGE'; message: v0_8.A2UIMessage }
  | {
      type: 'ERROR'
      error: {
        message: string
        code?: string
        reasonCode?: string
        recoverable?: boolean
        attempt?: number
      }
    }
  | { type: 'DONE' }
  | { type: 'RESET' }
  | { type: 'SAVE_INPUT'; input: ChatInput }
  | { type: typeof STREAM_ACTIONS.SET_CONVERSATION_ID; conversationId: string }

export type TitlebarPhase = (typeof TITLEBAR_PHASE)[keyof typeof TITLEBAR_PHASE]
