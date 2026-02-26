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

export const MODEL_IDS = {
  CLAUDE_SONNET_4: 'anthropic/claude-sonnet-4-20250514',
  CLAUDE_HAIKU_35: 'anthropic/claude-3-5-haiku-20241022',
  CLAUDE_OPUS_4: 'anthropic/claude-opus-4-20250514',
  GPT_4O: 'openai/gpt-4o',
  GPT_4O_MINI: 'openai/gpt-4o-mini',
  O4_MINI: 'openai/o4-mini',
  GEMINI_25_PRO: 'google/gemini-2.5-pro-preview',
  GEMINI_20_FLASH: 'google/gemini-2.0-flash',
  LLAMA_33_70B: 'meta-llama/llama-3.3-70b-instruct',
  LLAMA_31_8B: 'meta-llama/llama-3.1-8b-instruct',
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

export const ROUTER_MODEL = MODEL_IDS.LLAMA_31_8B
export const DEFAULT_MODEL = MODEL_IDS.CLAUDE_SONNET_4

export const PREFERRED_MODELS = {
  [MODEL_CATEGORIES.CODE]: MODEL_IDS.CLAUDE_SONNET_4,
  [MODEL_CATEGORIES.ANALYSIS]: MODEL_IDS.GEMINI_25_PRO,
  [MODEL_CATEGORIES.CREATIVE]: MODEL_IDS.CLAUDE_SONNET_4,
  [MODEL_CATEGORIES.VISION]: MODEL_IDS.CLAUDE_SONNET_4,
  [MODEL_CATEGORIES.FAST]: MODEL_IDS.LLAMA_33_70B,
  [MODEL_CATEGORIES.GENERAL]: MODEL_IDS.CLAUDE_SONNET_4,
} as const

export const UX = {
  STATUS_MIN_DISPLAY_MS: 500,
  THINKING_COLLAPSE_DEFAULT: true,
  STREAM_BUFFER_FLUSH_MS: 16,
  AUTO_SCROLL_THRESHOLD: 100,
  COPY_FEEDBACK_DURATION_MS: 2_000,
  QUERY_STALE_TIME_MS: 60_000,
  SIDEBAR_SWIPE_OPEN_THRESHOLD: 32,
  SIDEBAR_SWIPE_CLOSE_THRESHOLD: 64,
  TEXTAREA_MAX_HEIGHT_PIXELS: 192,
} as const

export const MOTION = {
  DURATION_FAST: 0.15,
  DURATION_NORMAL: 0.2,
  DURATION_MEDIUM: 0.25,
  DURATION_SLOW: 0.3,
  DURATION_LOOP: 1.5,
  STAGGER_CHILDREN: 0.05,
  SPRING_STIFFNESS: 400,
  SPRING_DAMPING: 25,
  EASING: [0.4, 0, 0.2, 1] as const,
} as const

export const AI_PARAMS = {
  ROUTER_MAX_TOKENS: 200,
  TITLE_MAX_TOKENS: 50,
  CHAT_MAX_TOKENS: 4096,
  ROUTER_TEMPERATURE: 0,
  TITLE_TEMPERATURE: 0.3,
} as const

export const MODEL_DEFAULT_CONTEXT_WINDOW = 4096 as const
export const MODEL_REGISTRY_CACHE_KEY = 'models' as const

export const NEW_CHAT_TITLE = 'New Chat' as const
export const NEW_CONVERSATION_TITLE = 'New Conversation' as const
export const CODE_BLOCK_FALLBACK_LANG = 'text' as const
export const SHIKI_DARK_THEME = 'vitesse-dark' as const
export const SHIKI_LIGHT_THEME = 'vitesse-light' as const

export const AI_REASONING = {
  MODEL_EXPLICIT: 'Model explicitly specified by user.',
  ROUTING_FALLBACK: 'Fallback to default model due to routing error.',
} as const

export const EXTERNAL_URLS = {
  OPENROUTER_API: 'https://openrouter.ai/api/v1',
  OPENROUTER_MODELS: 'https://openrouter.ai/api/v1/models',
  GCS_BASE: 'https://storage.googleapis.com',
} as const

export const APP_CONFIG = {
  NAME: 'Farasa',
  DEFAULT_LOCALHOST_URL: 'http://localhost:3000',
  THEME_COLOR: '#09090b',
  DEFAULT_THEME: 'dark',
} as const
