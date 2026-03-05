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
  SEARCH_UNAVAILABLE: 'Web search is currently unavailable.',
  TTS_PROVIDER_FAILED: 'TTS provider request failed.',
  TTS_RUNTIME_FAILED: 'TTS request failed before audio generation.',
  TTS_INVALID_BODY: 'Invalid request body',
  TTS_MISSING_TEXT: 'Missing text field',
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
