export const AppError = {
  UNAUTHORIZED: 'Unauthorized',
  NOT_FOUND: 'Not found',
  INTERNAL: 'Internal server error',
  INVALID_INPUT: 'Invalid input',
  UPLOAD_FAILED: 'Upload failed',
  SEARCH_FAILED: 'Search failed',
  AI_ERROR: 'AI service unavailable',
} as const

export type AppErrorCode = keyof typeof AppError
