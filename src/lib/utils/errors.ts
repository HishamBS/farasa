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
  SEARCH_UNAVAILABLE: 'Web search is currently unavailable.',
  TTS_PROVIDER_FAILED: 'TTS provider request failed.',
  TTS_RUNTIME_FAILED: 'TTS request failed before audio generation.',
  TTS_INVALID_BODY: 'Invalid request body',
  TTS_MISSING_TEXT: 'Missing text field',
} as const

export type AppErrorCode = keyof typeof AppError

export function getErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof Error) return err.message
  return fallback ?? String(err)
}
