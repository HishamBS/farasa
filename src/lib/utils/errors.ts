export const AppError = {
  UNAUTHORIZED: 'Unauthorized',
  NOT_FOUND: 'Not found',
  INTERNAL: 'Internal server error',
  INVALID_INPUT: 'Invalid input',
  UPLOAD_FAILED: 'Upload failed',
  SEARCH_FAILED: 'Search failed',
  AI_ERROR: 'AI service unavailable',
  CONNECTION: 'Connection error. Please try again.',
  CHAT_PROCESSING: 'An error occurred while processing your request.',
  INVALID_MODEL: 'Invalid model selection.',
  ATTACHMENT_ACCESS_DENIED: 'Attachment not found or access denied.',
  MISSING_CONVERSATION_ID: 'Missing conversation id for title generation.',
  ROUTER_FAILED: 'Auto-routing failed. Please select a model manually.',
  A2UI_CONTRACT_FAILED: 'UI generation failed format validation. Please retry your request.',
  IMAGE_GEN_INCOMPATIBLE: 'Selected model does not support image generation.',
  IMAGE_GEN_EMPTY_RESULT: 'Image generation returned no image artifact.',
  SEARCH_UNAVAILABLE: 'Web search is currently unavailable.',
  TTS_PROVIDER_FAILED: 'TTS provider request failed.',
  TTS_RUNTIME_FAILED: 'TTS request failed before audio generation.',
  TTS_INVALID_BODY: 'Invalid request body',
  TTS_MISSING_TEXT: 'Missing text field',
  DUPLICATE_STREAM: 'A stream is already active for this conversation.',
  SYNTHESIS_MODEL_CONFLICT: 'Synthesis model must be different from selected team models.',
  FILE_TOO_LARGE: 'File exceeds maximum allowed size.',
  STREAM_BOOTSTRAP_FAILED: 'Failed to start request.',
  CONNECTION_ERROR: 'Connection error.',
  CONNECTION_INTERRUPTED: 'Connection interrupted. Please try again.',
  MODEL_NOT_FOUND: 'Selected model not found in registry.',
  CONVERSATION_NOT_FOUND: 'Conversation not found.',
  CONVERSATION_CREATE_FAILED: 'Failed to create conversation.',
  UNAUTHORIZED_CONVERSATION: 'You do not have access to this conversation.',
  MISSING_CONTENT: 'Message content is required.',
  UNSUPPORTED_TOOL_CALL: 'Unsupported tool call.',
  TTS_UNAUTHORIZED: 'Authentication required.',
  TTS_TEXT_TOO_LONG: 'Text exceeds maximum length.',
  TTS_GENERATION_FAILED: 'Voice synthesis failed.',
  INVALID_MODEL_FOR_SEARCH: 'Model does not support web search tools.',
} as const

export type AppErrorCode = keyof typeof AppError

function normalizeKnownClientErrorMessage(message: string, fallback?: string): string {
  const lowered = message.toLowerCase()

  if (lowered.includes("unexpected token '<'") || lowered.includes('not valid json')) {
    return 'Upload request was rejected. The file may be too large.'
  }
  if (lowered.includes('413') || lowered.includes('file too large')) {
    return 'File too large. Please upload a smaller file.'
  }
  if (lowered.includes('network error')) {
    return AppError.CONNECTION
  }

  return message || fallback || AppError.INTERNAL
}

export function getErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof Error) {
    return normalizeKnownClientErrorMessage(err.message, fallback)
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string') {
      return normalizeKnownClientErrorMessage(message, fallback)
    }
  }
  return fallback ?? AppError.INTERNAL
}
