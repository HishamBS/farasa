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
} as const

export type AppErrorCode = keyof typeof AppError
