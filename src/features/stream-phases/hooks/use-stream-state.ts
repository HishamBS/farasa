import { CHAT_STREAM_STATUS, STREAM_ACTIONS, TOOL_NAMES } from '@/config/constants'
import type { StatusMessage, StreamAction, StreamState, ThinkingState } from '@/types/stream'
import { useCallback, useReducer } from 'react'

export const initialStreamState: StreamState = {
  phase: CHAT_STREAM_STATUS.IDLE,
  statusMessages: [],
  thinking: null,
  modelSelection: null,
  toolExecutions: [],
  textContent: '',
  a2uiMessages: [],
  error: null,
  lastInput: null,
  detectedSearchMode: false,
  pendingUserMessage: null,
  pendingClientRequestId: null,
  resolvedConversationId: null,
}

function markStatusMessagesComplete(messages: StatusMessage[], now: number): StatusMessage[] {
  return messages.map((m) => (m.completedAt ? m : { ...m, completedAt: now }))
}

function markThinkingComplete(thinking: ThinkingState | null, now: number): ThinkingState | null {
  if (!thinking || thinking.completedAt) return thinking
  return { ...thinking, completedAt: now }
}

export function streamStateReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case STREAM_ACTIONS.BEGIN: {
      return {
        ...state,
        phase: CHAT_STREAM_STATUS.ACTIVE,
      }
    }

    case STREAM_ACTIONS.STATUS: {
      const now = Date.now()
      return {
        ...state,
        phase: CHAT_STREAM_STATUS.ACTIVE,
        statusMessages: [
          ...markStatusMessagesComplete(state.statusMessages, now),
          { phase: action.phase, message: action.message },
        ],
      }
    }

    case STREAM_ACTIONS.MODEL_SELECTED: {
      const now = Date.now()
      return {
        ...state,
        modelSelection: {
          model: action.model,
          reasoning: action.reasoning,
          source: action.source,
          category: action.category,
          responseFormat: action.responseFormat,
          confidence: action.confidence,
          factors: action.factors,
        },
        statusMessages: markStatusMessagesComplete(state.statusMessages, now),
      }
    }

    case STREAM_ACTIONS.THINKING_CHUNK: {
      if (action.isComplete) {
        return {
          ...state,
          thinking: state.thinking ? { ...state.thinking, completedAt: Date.now() } : null,
        }
      }
      return {
        ...state,
        thinking: {
          content: (state.thinking?.content ?? '') + action.content,
          startedAt: state.thinking?.startedAt ?? Date.now(),
        },
      }
    }

    case STREAM_ACTIONS.TOOL_START: {
      return {
        ...state,
        toolExecutions: [...state.toolExecutions, { name: action.name, input: action.input }],
        detectedSearchMode: state.detectedSearchMode || action.name === TOOL_NAMES.WEB_SEARCH,
      }
    }

    case STREAM_ACTIONS.TOOL_RESULT: {
      const idx = [...state.toolExecutions]
        .reverse()
        .findIndex((t) => t.name === action.name && !t.completedAt)
      if (idx < 0) return state
      const realIdx = state.toolExecutions.length - 1 - idx
      const updated = [...state.toolExecutions]
      const current = updated[realIdx]
      if (current) {
        updated[realIdx] = { ...current, result: action.result, completedAt: Date.now() }
      }
      return { ...state, toolExecutions: updated }
    }

    case STREAM_ACTIONS.TEXT_CHUNK: {
      return { ...state, textContent: state.textContent + action.content }
    }

    case STREAM_ACTIONS.TEXT_SET: {
      return { ...state, textContent: action.content }
    }

    case STREAM_ACTIONS.A2UI_MESSAGE: {
      return {
        ...state,
        a2uiMessages: [...state.a2uiMessages, action.message],
      }
    }

    case STREAM_ACTIONS.ERROR: {
      const now = Date.now()
      return {
        ...state,
        phase: CHAT_STREAM_STATUS.ERROR,
        error: action.error,
        statusMessages: markStatusMessagesComplete(state.statusMessages, now),
        thinking: markThinkingComplete(state.thinking, now),
      }
    }

    case STREAM_ACTIONS.DONE: {
      const now = Date.now()
      return {
        ...state,
        phase: CHAT_STREAM_STATUS.COMPLETE,
        statusMessages: markStatusMessagesComplete(state.statusMessages, now),
        thinking: markThinkingComplete(state.thinking, now),
        pendingUserMessage: null,
        pendingClientRequestId: null,
      }
    }

    case STREAM_ACTIONS.SAVE_INPUT: {
      return {
        ...state,
        lastInput: action.input,
        pendingUserMessage: action.input.content,
        pendingClientRequestId: action.input.clientRequestId ?? null,
      }
    }

    case STREAM_ACTIONS.SET_CONVERSATION_ID: {
      return { ...state, resolvedConversationId: action.conversationId }
    }

    case STREAM_ACTIONS.RESET: {
      return {
        ...initialStreamState,
        pendingUserMessage: state.pendingUserMessage,
        pendingClientRequestId: state.pendingClientRequestId,
        resolvedConversationId: state.resolvedConversationId,
      }
    }

    case STREAM_ACTIONS.CLEAR_PENDING_USER_MESSAGE: {
      return { ...state, pendingUserMessage: null, pendingClientRequestId: null }
    }
  }
}

export function useStreamState() {
  const [state, dispatch] = useReducer(streamStateReducer, initialStreamState)
  const reset = useCallback(() => dispatch({ type: STREAM_ACTIONS.RESET }), [])
  return { state, dispatch, reset }
}
