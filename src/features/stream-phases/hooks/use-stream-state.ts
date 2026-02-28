import { useReducer, useCallback } from 'react'
import { CHAT_STREAM_STATUS, STREAM_ACTIONS } from '@/config/constants'
import type { StreamState, StreamAction } from '@/types/stream'

const initialState: StreamState = {
  phase: CHAT_STREAM_STATUS.IDLE,
  statusMessages: [],
  thinking: null,
  modelSelection: null,
  toolExecutions: [],
  textContent: '',
  a2uiMessages: [],
  error: null,
  lastInput: null,
}

function streamStateReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case STREAM_ACTIONS.STATUS: {
      const now = Date.now()
      const existing = state.statusMessages.findIndex((s) => s.phase === action.phase)
      if (existing >= 0) {
        const updated = [...state.statusMessages]
        const current = updated[existing]
        if (current) {
          updated[existing] = { ...current, completedAt: now }
        }
        return { ...state, statusMessages: updated }
      }
      return {
        ...state,
        phase: CHAT_STREAM_STATUS.ACTIVE,
        statusMessages: [...state.statusMessages, { phase: action.phase, message: action.message }],
      }
    }

    case STREAM_ACTIONS.MODEL_SELECTED: {
      const now = Date.now()
      const updatedStatus = state.statusMessages.map((s) =>
        s.completedAt ? s : { ...s, completedAt: now },
      )
      return {
        ...state,
        modelSelection: { model: action.model, reasoning: action.reasoning },
        statusMessages: updatedStatus,
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

    case STREAM_ACTIONS.A2UI_MESSAGE: {
      return {
        ...state,
        a2uiMessages: [...state.a2uiMessages, action.message],
      }
    }

    case STREAM_ACTIONS.ERROR: {
      return {
        ...state,
        phase: CHAT_STREAM_STATUS.ERROR,
        error: action.message,
      }
    }

    case STREAM_ACTIONS.DONE: {
      return { ...state, phase: CHAT_STREAM_STATUS.COMPLETE }
    }

    case STREAM_ACTIONS.SAVE_INPUT: {
      return { ...state, lastInput: action.input }
    }

    case STREAM_ACTIONS.RESET: {
      return { ...initialState, lastInput: state.lastInput }
    }
  }
}

export function useStreamState() {
  const [state, dispatch] = useReducer(streamStateReducer, initialState)
  const reset = useCallback(() => dispatch({ type: STREAM_ACTIONS.RESET }), [])
  return { state, dispatch, reset }
}
