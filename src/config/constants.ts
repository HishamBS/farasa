export const LIMITS = {
  MESSAGE_MAX_LENGTH: 32_000,
  FILE_MAX_SIZE_BYTES: 10 * 1024 * 1024,
  CONVERSATION_TITLE_MAX_LENGTH: 200,
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 50,
  MODEL_REGISTRY_CACHE_TTL_MS: 60 * 60 * 1000,
  UPLOAD_URL_EXPIRY_MS: 15 * 60 * 1000,
  STREAM_TIMEOUT_MS: 60_000,
  SEARCH_MAX_RESULTS: 10,
  CODE_BLOCK_LINE_NUMBER_THRESHOLD: 5,
} as const

export const SUPPORTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const

export const MODEL_CATEGORIES = {
  CODE: 'code',
  ANALYSIS: 'analysis',
  CREATIVE: 'creative',
  VISION: 'vision',
  GENERAL: 'general',
  FAST: 'fast',
} as const

export const STREAM_EVENTS = {
  STATUS: 'status',
  THINKING: 'thinking',
  MODEL_SELECTED: 'model_selected',
  TOOL_START: 'tool_start',
  TOOL_RESULT: 'tool_result',
  TEXT: 'text',
  A2UI: 'a2ui',
  ERROR: 'error',
  DONE: 'done',
} as const

export const STREAM_PHASES = {
  ROUTING: 'routing',
  THINKING: 'thinking',
  SEARCHING: 'searching',
  READING_FILES: 'reading_files',
  GENERATING_UI: 'generating_ui',
  GENERATING_TITLE: 'generating_title',
} as const

export const CHAT_STREAM_STATUS = {
  IDLE: 'idle',
  ACTIVE: 'active',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const

export const CHAT_MODES = {
  CHAT: 'chat',
  SEARCH: 'search',
} as const

export const TOOL_NAMES = {
  WEB_SEARCH: 'web_search',
} as const

export const STATUS_MESSAGES = {
  ROUTING: 'Selecting the best model for your request...',
  THINKING: 'Thinking...',
  SEARCHING: 'Searching the web...',
  READING_FILES: 'Processing your files...',
  GENERATING_UI: 'Building your interface...',
  GENERATING_TITLE: 'Generating title...',
} as const

export const PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  META: 'meta',
  GROQ: 'groq',
  CEREBRAS: 'cerebras',
} as const

export const ROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct' as const
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514' as const

export const UX = {
  STATUS_MIN_DISPLAY_MS: 500,
  THINKING_COLLAPSE_DEFAULT: true,
  STREAM_BUFFER_FLUSH_MS: 16,
  AUTO_SCROLL_THRESHOLD: 100,
  COPY_FEEDBACK_DURATION_MS: 2_000,
} as const

export const MOTION = {
  DURATION_FAST: 0.15,
  DURATION_NORMAL: 0.2,
  DURATION_MEDIUM: 0.25,
  DURATION_SLOW: 0.3,
  STAGGER_CHILDREN: 0.05,
  SPRING_STIFFNESS: 400,
  SPRING_DAMPING: 25,
  EASING: [0.4, 0, 0.2, 1] as const,
} as const
