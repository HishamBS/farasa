export const LIMITS = {
  MESSAGE_MAX_LENGTH: 32_000,
  FILE_MAX_SIZE_BYTES: 10 * 1024 * 1024,
  INLINE_UPLOAD_MAX_SIZE: 14 * 1024 * 1024,
  FILE_NAME_MAX_LENGTH: 255,
  CONVERSATION_TITLE_MAX_LENGTH: 200,
  SEARCH_QUERY_MAX_LENGTH: 200,
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 50,
  MODEL_REGISTRY_CACHE_TTL_MS: 60 * 60 * 1000,
  REGISTRY_FETCH_TIMEOUT_MS: 10_000,
  UPLOAD_URL_EXPIRY_MS: 15 * 60 * 1000,
  STREAM_TIMEOUT_MS: 180_000,
  ROUTER_TIMEOUT_MS: 15_000,
  IMAGE_GEN_TIMEOUT_MS: 120_000,
  TITLE_GEN_TIMEOUT_MS: 15_000,
  SEARCH_MAX_RESULTS: 10,
  SEARCH_MAX_TOOL_CALL_ROUNDS: 12,
  CODE_BLOCK_LINE_NUMBER_THRESHOLD: 5,
  CODE_BLOCK_COLLAPSE_THRESHOLD: 15,
  TOKENS_PER_K: 1_000,
  CONVERSATION_HISTORY_LIMIT: 20,
  RUNTIME_CONFIG_CACHE_TTL_MS: 5_000,
  EMPTY_STATE_CHIP_COUNT: 4,
  GATE_COOKIE_MAX_AGE_SECONDS: 30 * 24 * 60 * 60,
  ROUTER_MAX_ATTEMPTS: 2,
  DROPDOWN_EDGE_GUTTER: 8,
  TITLE_SKELETON_TIMEOUT_MS: 30_000,
  ATTACHMENT_LINK_MAX_RETRIES: 3,
  ATTACHMENT_LINK_RETRY_DELAY_MS: 500,
  SEARCH_TIMEOUT_MS: 15_000,
  RATE_LIMIT_EVICTION_THRESHOLD: 1_000,
  COST_PER_MILLION_DIVISOR: 1_000_000,
  ROUTER_DEFAULT_CONFIDENCE: 0.75,
  ROUTER_CONFIDENCE_MIN: 0,
  ROUTER_CONFIDENCE_MAX: 1,
} as const

export const COOKIE_NAMES = {
  ACCESS_GATE: 'farasa_gate',
} as const

export const RATE_LIMITS = {
  CHAT_PER_MINUTE: 20,
  UPLOAD_PER_MINUTE: 30,
  WINDOW_MS: 60_000,
  ERROR_MESSAGE: 'Too many requests. Please slow down.',
} as const

export const SUPPORTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'text/xml',
  'text/x-python',
  'text/x-typescript',
  'text/x-java',
  'text/x-c',
  'text/x-go',
  'text/x-rust',
  'text/x-yaml',
  'text/x-toml',
  'text/x-shellscript',
] as const

export const FILE_EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  xml: 'text/xml',
  py: 'text/x-python',
  ts: 'text/x-typescript',
  java: 'text/x-java',
  c: 'text/x-c',
  go: 'text/x-go',
  rs: 'text/x-rust',
  yaml: 'text/x-yaml',
  yml: 'text/x-yaml',
  toml: 'text/x-toml',
  sh: 'text/x-shellscript',
}

export const MODEL_CATEGORIES = {
  CODE: 'code',
  ANALYSIS: 'analysis',
  CREATIVE: 'creative',
  VISION: 'vision',
  IMAGE_GENERATION: 'image_generation',
  GENERAL: 'general',
  FAST: 'fast',
} as const

export const RESPONSE_FORMATS = {
  MARKDOWN: 'markdown',
  A2UI: 'a2ui',
} as const

export const MODEL_IDS = {
  LLAMA_31_8B: 'meta-llama/llama-3.1-8b-instruct',
  GEMINI_FLASH_LITE: 'google/gemini-2.0-flash-lite-001',
  GEMINI_3_FLASH_PREVIEW: 'google/gemini-3-flash-preview',
} as const

export const ROUTER_CAPABILITY_PATTERNS = {
  CODE: ['code', 'coder', 'codex', 'starcoder'] as const,
  FAST: ['flash', 'lite', 'mini', 'haiku', 'nano'] as const,
  ANALYSIS: ['o1', 'o3', 'o4', 'sonnet', 'opus', 'ultra'] as const,
} as const

type ModelCategoryValue = (typeof MODEL_CATEGORIES)[keyof typeof MODEL_CATEGORIES]

export const CATEGORY_ICONS: Record<ModelCategoryValue, string> = {
  [MODEL_CATEGORIES.CODE]: 'Code',
  [MODEL_CATEGORIES.ANALYSIS]: 'Brain',
  [MODEL_CATEGORIES.CREATIVE]: 'Sparkles',
  [MODEL_CATEGORIES.VISION]: 'Eye',
  [MODEL_CATEGORIES.IMAGE_GENERATION]: 'Image',
  [MODEL_CATEGORIES.GENERAL]: 'Globe',
  [MODEL_CATEGORIES.FAST]: 'Zap',
}

export const CATEGORY_LABELS: Record<ModelCategoryValue, string> = {
  [MODEL_CATEGORIES.CODE]: 'Code generation',
  [MODEL_CATEGORIES.ANALYSIS]: 'Deep analysis',
  [MODEL_CATEGORIES.CREATIVE]: 'Creative writing',
  [MODEL_CATEGORIES.VISION]: 'Image understanding',
  [MODEL_CATEGORIES.IMAGE_GENERATION]: 'Image generation',
  [MODEL_CATEGORIES.GENERAL]: 'General purpose',
  [MODEL_CATEGORIES.FAST]: 'Quick response',
}

export const VOICE = {
  TTS_MODEL: 'openai/gpt-audio-mini',
  TTS_VOICE: 'alloy',
  TTS_FORMAT: 'pcm16',
  TTS_SAMPLE_RATE: 24_000,
  TTS_MAX_CHARS: 4_096,
  STT_LANG: 'en-US',
  STT_CONTINUOUS: true,
  STT_INTERIM_RESULTS: true,
} as const

export const VOICE_TTS_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SPEAKING: 'speaking',
  ERROR: 'error',
  UNAVAILABLE: 'unavailable',
} as const

export const VOICE_STT_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  ERROR: 'error',
} as const

export const UI = {
  IMAGE_PREVIEW_WIDTH: 400,
  IMAGE_PREVIEW_HEIGHT: 300,
  AVATAR_SIZE: 28,
} as const

export const STREAM_EVENTS = {
  STATUS: 'status',
  THINKING: 'thinking',
  MODEL_SELECTED: 'model_selected',
  TOOL_START: 'tool_start',
  TOOL_RESULT: 'tool_result',
  TEXT: 'text',
  TEXT_SET: 'text_set',
  A2UI: 'a2ui',
  ERROR: 'error',
  DONE: 'done',
  USER_MESSAGE_SAVED: 'user_message_saved',
  CONVERSATION_CREATED: 'conversation_created',
  TITLE_UPDATED: 'title_updated',
} as const

export const STREAM_PHASES = {
  ROUTING: 'routing',
  THINKING: 'thinking',
  SEARCHING: 'searching',
  READING_FILES: 'reading_files',
  GENERATING_UI: 'generating_ui',
  GENERATING_TITLE: 'generating_title',
  GENERATING_IMAGE: 'generating_image',
} as const

export const CHAT_STREAM_STATUS = {
  IDLE: 'idle',
  ACTIVE: 'active',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const

export const TITLEBAR_PHASE = {
  IDLE: 'idle',
  THINKING: 'thinking',
  STREAMING: 'streaming',
  DONE: 'done',
} as const

export const STREAM_ACTIONS = {
  STATUS: 'STATUS',
  MODEL_SELECTED: 'MODEL_SELECTED',
  THINKING_CHUNK: 'THINKING_CHUNK',
  TOOL_START: 'TOOL_START',
  TOOL_RESULT: 'TOOL_RESULT',
  TEXT_CHUNK: 'TEXT_CHUNK',
  TEXT_SET: 'TEXT_SET',
  A2UI_MESSAGE: 'A2UI_MESSAGE',
  ERROR: 'ERROR',
  DONE: 'DONE',
  RESET: 'RESET',
  SAVE_INPUT: 'SAVE_INPUT',
  SET_CONVERSATION_ID: 'SET_CONVERSATION_ID',
  CLEAR_PENDING_USER_MESSAGE: 'CLEAR_PENDING_USER_MESSAGE',
  BEGIN: 'BEGIN',
} as const

export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
} as const

export const TRPC_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const

export const CHAT_MODES = {
  CHAT: 'chat',
  TEAM: 'team',
} as const

export const TOOL_NAMES = {
  WEB_SEARCH: 'web_search',
} as const

export const SEARCH_DEPTHS = {
  BASIC: 'basic',
  ADVANCED: 'advanced',
} as const

export const RETRY_DEFAULTS = {
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 5000,
  JITTER_MS: 500,
} as const

export const SPEECH_ERRORS = {
  ABORTED: 'aborted',
  NO_SPEECH: 'no-speech',
  NOT_ALLOWED: 'not-allowed',
} as const

export const STATUS_MESSAGES = {
  ROUTING: 'Finding the best model for you...',
  THINKING: 'Thinking...',
  SEARCHING: 'Searching the web...',
  READING_FILES: 'Processing your files...',
  GENERATING_UI: 'Building your interface...',
  GENERATING_TITLE: 'Generating title...',
  GENERATING_IMAGE: 'Generating image...',
  THOUGHT_FOR_LABEL: 'Thought for',
  THOUGHT_DURATION_UNIT: 's',
} as const

export const CHAT_ERRORS = {
  UNAUTHORIZED: 'Please sign in to continue.',
  CONNECTION: 'Connection lost. Please try again.',
  PROCESSING: 'Something went wrong. Please try again.',
  INVALID_MODEL: 'The selected model is unavailable.',
  IMAGE_GEN_INCOMPATIBLE:
    'This model does not support image generation. Please select an image-capable model.',
  PROVIDER_UNAVAILABLE: 'The AI provider is temporarily unavailable. Please try again shortly.',
  CONTEXT_OVERFLOW:
    'This conversation has grown too large for the selected model. Please start a new chat to continue.',
  FILE_PROCESSING: 'Failed to process the attached file. Please try a different file or format.',
} as const

export const IMAGE_STRIP_PLACEHOLDER = 'previously-generated-image' as const

export const STREAM_PROGRESS = {
  STATUS: {
    INACTIVE: 'inactive',
    ACTIVE: 'active',
    THINKING: 'thinking',
    DONE: 'done',
  },
  IDS: {
    ROUTING: 'routing',
    SELECTED: 'selected',
    STREAMING: 'streaming',
  },
  ORDER: [STREAM_PHASES.ROUTING, STREAM_PHASES.THINKING, 'streaming', 'done'] as const,
  LABELS: {
    [STREAM_PHASES.ROUTING]: 'Smart Pick',
    [STREAM_PHASES.THINKING]: 'Thinking',
    [STREAM_PHASES.SEARCHING]: 'Searching',
    [STREAM_PHASES.READING_FILES]: 'Reading',
    [STREAM_PHASES.GENERATING_UI]: 'Rendering',
    [STREAM_PHASES.GENERATING_TITLE]: 'Title',
    [STREAM_PHASES.GENERATING_IMAGE]: 'Image',
    STREAMING: 'Responding',
    DONE: 'Done',
  },
} as const

export const FACTOR_GROUPS = [
  { id: 'task', label: 'Understood your request', patterns: ['task', 'execution', 'category'] },
  { id: 'capability', label: 'Checked capabilities', patterns: ['tool', 'search', 'vision'] },
  { id: 'response', label: 'Response style', patterns: ['response', 'format'] },
  { id: 'selection', label: 'Selected best match', patterns: ['source', 'selected', 'review'] },
  { id: 'model', label: 'Found best match', patterns: ['model'] },
] as const

export const A2UI_COMPONENT_CATEGORIES = {
  Layout: ['Column', 'Row', 'Card', 'List', 'Tabs', 'Modal', 'Divider'],
  Display: ['Text', 'Image', 'Icon', 'Video', 'AudioPlayer', 'CodeBlock'],
  Interactive: ['Button', 'TextField', 'CheckBox', 'Slider', 'MultipleChoice', 'DateTimeInput'],
} as const

export const A2UI_COMPONENT_TYPES = [
  ...A2UI_COMPONENT_CATEGORIES.Layout,
  ...A2UI_COMPONENT_CATEGORIES.Display,
  ...A2UI_COMPONENT_CATEGORIES.Interactive,
] as const

export const A2UI_TYPES_LIST = A2UI_COMPONENT_TYPES.join(', ')

export const A2UI_ACTIONS = {
  NEW_CHAT: 'newchat',
  RENAME: 'rename',
  PIN: 'pin',
  UNPIN: 'unpin',
  DELETE: 'delete',
  REFRESH_MODELS: 'refreshmodels',
  SEARCH: 'search',
} as const

export const A2UI_ACTION_PREFIXES = {
  SUBMIT: 'submit',
  PARSE: 'parse',
  CANCEL: 'cancel',
} as const

export const A2UI_ACTION_EXACT = {
  GENERATE: 'generate',
  TRANSFORM: 'transform',
} as const

export const AI_MARKUP = {
  A2UI_FENCE_START: '```a2ui',
  CODE_FENCE_END: '```',
} as const

export const PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  META: 'meta',
  GROQ: 'groq',
  CEREBRAS: 'cerebras',
  QWEN: 'qwen',
  MISTRALAI: 'mistralai',
  DEEPSEEK: 'deepseek',
} as const

export const PROVIDER_ALIASES: Record<string, string> = {
  'meta-llama': PROVIDERS.META,
  qwen: PROVIDERS.QWEN,
  mistralai: PROVIDERS.MISTRALAI,
  deepseek: PROVIDERS.DEEPSEEK,
}

export const PROVIDER_DOT_CLASSES: Record<string, string> = {
  [PROVIDERS.ANTHROPIC]: 'bg-(--provider-anthropic)',
  [PROVIDERS.OPENAI]: 'bg-(--provider-openai)',
  [PROVIDERS.GOOGLE]: 'bg-(--provider-google)',
  [PROVIDERS.META]: 'bg-(--provider-meta)',
  [PROVIDERS.GROQ]: 'bg-(--provider-groq)',
  [PROVIDERS.CEREBRAS]: 'bg-(--provider-cerebras)',
  [PROVIDERS.QWEN]: 'bg-(--provider-qwen)',
  [PROVIDERS.MISTRALAI]: 'bg-(--provider-mistralai)',
  [PROVIDERS.DEEPSEEK]: 'bg-(--provider-deepseek)',
}

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  [PROVIDERS.OPENAI]: 'OpenAI',
  [PROVIDERS.ANTHROPIC]: 'Anthropic',
  [PROVIDERS.GOOGLE]: 'Google',
  [PROVIDERS.META]: 'Meta',
  [PROVIDERS.GROQ]: 'Groq',
  [PROVIDERS.CEREBRAS]: 'Cerebras',
  [PROVIDERS.QWEN]: 'Qwen',
  [PROVIDERS.MISTRALAI]: 'Mistral AI',
  [PROVIDERS.DEEPSEEK]: 'DeepSeek',
}

export const UX = {
  STATUS_MIN_DISPLAY_MS: 500,
  THINKING_COLLAPSE_DEFAULT: true,
  STREAM_BUFFER_FLUSH_MS: 16,
  AUTO_SCROLL_THRESHOLD: 100,
  COPY_FEEDBACK_DURATION_MS: 2_000,
  QUERY_STALE_TIME_MS: 60_000,
  SIDEBAR_SWIPE_THRESHOLD: 60,
  SIDEBAR_SWIPE_OPEN_THRESHOLD: 32,
  SIDEBAR_SWIPE_CLOSE_THRESHOLD: 64,
  TEXTAREA_MAX_HEIGHT_PIXELS: 120,
  SIDEBAR_SKELETON_COUNT: 6,
  SCROLL_BUTTON_BOTTOM_OFFSET: 24,
  LONG_PRESS_DELAY_MS: 500,
  TITLE_REVALIDATION_DELAY_MS: 4_000,
  QUERY_STALE_TIME_FOREVER: Infinity,
  QUERY_GC_TIME_MS: 30 * 60_000,
  SEND_BUTTON_HOVER_SCALE: 1.08,
  DONE_NOTIFICATION_DURATION_MS: 2_000,
  SIDEBAR_DRAG_ELASTIC: 0.3,
  ROUTING_MIN_DISPLAY_MS: 800,
  SIDEBAR_IDLE_AUTO_MINIMIZE_MS: 6_000,
  CODE_BLOCK_PREVIEW_LINES: 4,
  CODE_BLOCK_LINE_HEIGHT: 1.65,
  CODE_BLOCK_FONT_SIZE_REM: 0.75,
  CODE_BLOCK_PREVIEW_PADDING_REM: 1,
  PROSE_BODY_CLASS: 'text-[0.90625rem] leading-[1.72] text-(--text-primary)',
  INFINITE_SCROLL_THRESHOLD: 0.1,
  MODEL_MENU_FALLBACK_HEIGHT: 320,
  MODEL_MENU_FALLBACK_WIDTH: 352,
  DROPDOWN_Z_INDEX: 9999,
  ARTIFACT_PANEL_MAX_HEIGHT_PX: 600,
} as const

export const MOTION = {
  DURATION_FAST: 0.16,
  DURATION_NORMAL: 0.2,
  DURATION_MEDIUM: 0.25,
  DURATION_SLOW: 0.35,
  DURATION_EXTRA_SLOW: 0.4,
  DURATION_EXTRA_FAST: 0.15,
  DURATION_LOOP: 1.5,
  DURATION_BACKGROUND_LOOP: 4,
  STAGGER_CHILDREN: 0.05,
  STAGGER_DOTS: 0.12,
  EXPLORE_REVEAL_DELAY: 0.1,
  SPRING_STIFFNESS: 400,
  SPRING_DAMPING: 25,
  EASING: [0.4, 0, 0.2, 1] as const,
  EASING_IN_OUT: 'easeInOut',
  EASING_LINEAR: 'linear',
  REPEAT_INFINITE: Infinity,
  THINKING_PULSE_Y: 3,
  PILL_OFFSET_Y: -4,
  PILL_SCALE: 0.98,
  SCALE_EXIT: 0.8,
  SCALE_SUBTLE_EXIT: 0.95,
  SCALE_HOVER_MICRO: 1.01,
  SCALE_TAP_MICRO: 0.99,
} as const

export const AI_PARAMS = {
  ROUTER_MAX_TOKENS: 512,
  TITLE_MAX_TOKENS: 50,
  CHAT_MAX_TOKENS_FALLBACK: 4096,
  ROUTER_TEMPERATURE: 0,
  TITLE_TEMPERATURE: 0.3,
  THINKING_HISTORICAL_STARTAT_MS: 0,
  REASONING_EFFORT: 'high' as const,
} as const

export const MODEL_SELECTION_SOURCES = {
  EXPLICIT_REQUEST: 'explicit_request',
  CONVERSATION_DEFAULT: 'conversation_default',
  USER_DEFAULT: 'user_default',
  AUTO_ROUTER: 'auto_router',
} as const

export const ROUTING_PHASE_LABELS = {
  ANALYZE: 'Analyze',
  MATCH: 'Match',
  RESULT: 'Result',
} as const

export const ROUTING_PHASE_FALLBACKS = {
  ANALYZED: 'Assessed request',
  MATCHED: 'Best fit found',
} as const

export const EXPANDABLE_BLOCKS = {
  ROUTING: 'routing',
  THINKING: 'thinking',
} as const

export const STREAM_REASON_CODES = {
  AUTHORIZATION_EXPIRED: 'authorization_expired',
  ROUTER_FAILED: 'router_failed',
  IMAGE_GEN_INCOMPATIBLE: 'image_gen_incompatible',
  IMAGE_GEN_EMPTY_RESULT: 'image_gen_empty_result',
  VALIDATION_REJECTED: 'validation_rejected',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  TRANSIENT_NETWORK: 'transient_network',
  CANCELLED: 'cancelled_by_client',
  SUPERSEDED: 'superseded_by_new_stream',
  STREAM_CLOSED: 'stream_closed_unexpectedly',
  FILE_PROCESSING_FAILED: 'file_processing_failed',
  CONTEXT_OVERFLOW: 'context_overflow',
} as const

export const MODEL_REGISTRY_CACHE_KEY = 'models' as const

export const NEW_CHAT_TITLE = 'New Chat' as const
export const CODE_BLOCK_DEFAULT_LANG = 'text' as const
export const SHIKI_DARK_THEME = 'tokyo-night' as const
export const SHIKI_LIGHT_THEME = 'github-light' as const

export const AI_REASONING = {
  MODEL_EXPLICIT: 'Model explicitly specified by user.',
  MODEL_CONVERSATION_DEFAULT: 'Using the model configured for this conversation.',
  MODEL_USER_DEFAULT: 'Using your default model preference.',
  MODEL_AUTO_ROUTER: 'Model selected by the auto router.',
} as const

export const EXTERNAL_URLS = {
  OPENROUTER_MODELS: 'https://openrouter.ai/api/v1/models',
  OPENROUTER_CHAT_COMPLETIONS: 'https://openrouter.ai/api/v1/chat/completions',
  GCS_BASE: 'https://storage.googleapis.com',
} as const

export const THEMES = ['light', 'dark', 'system'] as const

export const MESSAGE_DELIMITERS = {
  MESSAGE_OPEN: '<message>',
  MESSAGE_CLOSE: '</message>',
  SEARCH_RESULTS_OPEN: '<search_results>',
  SEARCH_RESULTS_CLOSE: '</search_results>',
  SEARCH_RESULT_OPEN: '<search_result>',
  SEARCH_RESULT_CLOSE: '</search_result>',
} as const

export const APP_CONFIG = {
  NAME: 'Farasa',
  DEFAULT_LOCALHOST_URL: 'http://localhost:3010',
  THEME_COLOR: '#09090b',
  DEFAULT_THEME: 'dark' satisfies (typeof THEMES)[number],
  LOCALE: 'en',
  CHAT_PLACEHOLDER: 'Ask anything…',
} as const

export const EMPTY_STATE_SUGGESTIONS = [
  {
    title: 'Explain quantum computing',
    label: 'in simple terms',
    prompt:
      'Explain quantum computing in simple terms, focusing on the core concepts without complex math.',
    icon: 'BrainCircuit',
  },
  {
    title: 'Write a Python script',
    label: 'to parse CSV files',
    prompt:
      'Write a Python script using pandas to parse a large CSV file, clean the data, and output a summary report.',
    icon: 'Terminal',
  },
  {
    title: 'Summarize the latest',
    label: 'AI research trends',
    prompt: 'Summarize the latest AI research trends, focusing on LLMs and multimodal models.',
    icon: 'Sparkles',
  },
  {
    title: 'Draft an email',
    label: 'to a potential client',
    prompt:
      'Draft a professional and engaging email to a potential client introducing our web development services.',
    icon: 'Mail',
  },
  {
    title: 'Help me debug',
    label: 'a React hydration error',
    prompt:
      'I am getting a React hydration mismatch error in my Next.js app. What are the common causes and how do I fix it?',
    icon: 'Bug',
  },
  {
    title: 'Plan a learning roadmap',
    label: 'for machine learning',
    prompt:
      'Create a 3-month learning roadmap for a beginner wanting to learn machine learning, including key topics and resources.',
    icon: 'Map',
  },
  {
    title: 'Brainstorm brand names',
    label: 'for a tech startup',
    prompt:
      'Brainstorm 10 creative and modern brand names for a new AI-focused tech startup, including domain availability ideas.',
    icon: 'Lightbulb',
  },
  {
    title: 'Review my resume',
    label: 'for a frontend role',
    prompt:
      'Acting as a senior engineering manager, please review my resume for a Senior Frontend Developer role and suggest improvements.',
    icon: 'FileText',
  },
  {
    title: 'Teach me how to use',
    label: 'Docker containers',
    prompt:
      'Teach me the basics of Docker. What are containers, images, and volumes? Provide a simple example of a Dockerfile.',
    icon: 'Box',
  },
  {
    title: 'Build me a survey',
    label: 'about developer tools',
    prompt:
      'Build an interactive survey form about developer tool preferences. Include multiple choice questions, text fields for open feedback, and a submit button. Make it visually engaging.',
    icon: 'ClipboardList',
  },
  {
    title: 'Create a calculator',
    label: 'for project estimates',
    prompt:
      'Create an interactive project cost estimation calculator. Include fields for team size, project duration, hourly rate, and a slider for complexity level. Calculate and display the total estimate when submitted.',
    icon: 'Calculator',
  },
  {
    title: 'Design a booking form',
    label: 'for appointments',
    prompt:
      'Design an interactive appointment booking form with fields for name, email, date selection, time preference, and service type (multiple choice). Include submit and cancel buttons.',
    icon: 'CalendarCheck',
  },
] as const

export const UI_TEXT = {
  SIDEBAR_SEARCH_PLACEHOLDER: 'Search conversations',
  NEW_CHAT_ARIA_LABEL: 'New chat',
  OFFLINE_BANNER: "You're offline — your conversations will be here when you're back",
  NEW_MESSAGES_LABEL: 'New messages',
  OPEN_SIDEBAR_ARIA: 'Open sidebar',
  CHAT_KEYBOARD_HINT: '↵ send · ⇧↵ newline',
  DELETE_CONFIRM_TITLE: 'Delete conversation?',
  DELETE_CONFIRM_BODY: 'This will permanently delete the conversation and all its messages.',
  DELETE_CONFIRM_ACTION: 'Delete',
  WELCOME_HEADING: 'Welcome to farasa',
  WELCOME_BODY:
    "I'm your AI assistant. Let's build something amazing together today. What's on your mind?",
  EXPLORE_MORE: 'Explore more',
  MORE_OPTIONS_ARIA: 'More options',
  SET_DEFAULT_MODEL: 'Set default',
  DEFAULT_MODEL_SET: 'Default',
  TEAM_MODEL_HINT: 'Select 2–5 models to compare as a team',
  TEAM_MODEL_PICKER_OPEN_ARIA: 'Select team models',
  TEAM_MODEL_PICKER_TITLE: 'Select team comparison models',
  TEAM_MODEL_PICKER_DONE: 'Done',
  MODEL_SEARCH_PLACEHOLDER: 'Search models...',
  TEAM_MODEL_REMOVE_ARIA_PREFIX: 'Remove',
  TEAM_SYNTHESIZER_SELECT_ARIA_PREFIX: 'Select synthesizer',
  TEAM_SYNTHESIZE_ARIA: 'Synthesize team responses',
  WEB_SEARCH_ENABLE: 'Enable web search',
  WEB_SEARCH_DISABLE: 'Disable web search',
  WEB_SEARCH_ACTIVE: 'Web search on',
  WEB_SEARCH_MODEL_INCOMPATIBLE: 'Selected model does not support web search',
  STT_TRANSCRIPTION_FAILED: 'Speech recognition failed. Please try again.',
  STT_PERMISSION_DENIED: 'Microphone access was denied. Please enable it in your browser settings.',
  STT_UNSUPPORTED: 'Speech recognition is not supported in this browser.',
  STT_START: 'Start voice input',
  STT_STOP: 'Stop voice input',
  TTS_UNAVAILABLE: 'Text-to-speech is currently unavailable.',
  TTS_READ_ALOUD: 'Read aloud',
  TTS_STOP: 'Stop reading',
  TTS_LOADING: 'Loading audio...',
  DEFAULT_MODEL_LABEL: 'Selected model',
  CANCEL: 'Cancel',
  SAVE: 'Save',
  RENAME_TITLE: 'Rename Conversation',
  RENAME_DESCRIPTION: 'Choose a clear title for this thread.',
  RENAME_PLACEHOLDER: 'Conversation title',
  ERROR_BOUNDARY_FALLBACK: 'Something went wrong. Please try refreshing the page.',
  MODE_TOGGLE_DISABLED_HINT: 'Cannot switch mode during active stream',
} as const

export const TEAM_LIMITS = {
  MAX_MODELS: 5,
  MIN_MODELS: 2,
} as const

export const TEAM_EVENTS = {
  MODEL_CHUNK: 'team_model_chunk',
  STREAM_EVENT: 'team_stream_event',
  PERSISTED: 'team_persisted',
  DONE: 'team_done',
  SYNTHESIS_CHUNK: 'team_synthesis_chunk',
  SYNTHESIS_DONE: 'team_synthesis_done',
} as const

export const TEAM_TAB_VALUES = {
  SYNTHESIS: 'synthesis',
} as const

export const TEAM_STREAM_PHASES = {
  IDLE: 'idle',
  ACTIVE: 'active',
  DONE: 'done',
  ERROR: 'error',
} as const

export const BROWSER_EVENTS = {
  NEW_CHAT_REQUESTED: 'farasa:new-chat-requested',
  A2UI_ACTION_REQUESTED: 'farasa:a2ui-action-requested',
} as const

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const

export const TEAM_TAB_STATUS = {
  IDLE: 'idle',
  STREAMING: 'streaming',
  DONE: 'done',
  ERROR: 'error',
} as const

export const TERMINAL_EVENTS = {
  DONE: 'done',
  ERROR: 'error',
  CANCELLED: 'cancelled',
} as const

export const RUNTIME_SCOPES = {
  SYSTEM: 'system',
  TENANT: 'tenant',
  USER: 'user',
} as const

export const DB_ERROR_CODES = {
  UNDEFINED_TABLE: '42P01',
} as const

export const MARKDOWN_SANITIZE = {
  TAG_NAMES: [
    'math',
    'semantics',
    'mrow',
    'mi',
    'mn',
    'mo',
    'msup',
    'msub',
    'mfrac',
    'msqrt',
    'mstyle',
    'mspace',
    'mtable',
    'mtr',
    'mtd',
    'annotation',
  ] as const,
  ATTRIBUTES: {
    CODE: ['className'] as const,
    SPAN: ['className', 'style'] as const,
    MATH: ['xmlns', 'display'] as const,
    ANNOTATION: ['encoding'] as const,
    MSPACE: ['width'] as const,
    IMG: ['src', 'alt', 'width', 'height'] as const,
  },
} as const
