import {
  AI_PARAMS,
  CHAT_ERRORS,
  LIMITS,
  MESSAGE_DELIMITERS,
  MODEL_IDS,
  RATE_LIMITS,
  SEARCH_DEPTHS,
  STATUS_MESSAGES,
  SUPPORTED_FILE_TYPES,
  TOOL_NAMES,
  UX,
} from '@/config/constants'
import { PROMPTS, USER_REQUEST_DELIMITERS } from '@/config/prompts'
import { z } from 'zod'

const StreamRetryPolicySchema = z
  .object({
    maxAttempts: z.number().int().min(0).default(0),
    baseDelayMs: z.number().int().min(0).default(1000),
    maxDelayMs: z.number().int().positive().default(5000),
    jitterMs: z.number().int().min(0).default(500),
  })
  .default({})

const StatusMessagesSchema = z
  .object({
    routing: z.string().min(1).default(STATUS_MESSAGES.ROUTING),
    thinking: z.string().min(1).default(STATUS_MESSAGES.THINKING),
    searching: z.string().min(1).default(STATUS_MESSAGES.SEARCHING),
    readingFiles: z.string().min(1).default(STATUS_MESSAGES.READING_FILES),
    generatingUi: z.string().min(1).default(STATUS_MESSAGES.GENERATING_UI),
    generatingTitle: z.string().min(1).default(STATUS_MESSAGES.GENERATING_TITLE),
  })
  .default({})

const ChatErrorsSchema = z
  .object({
    unauthorized: z.string().min(1).default(CHAT_ERRORS.UNAUTHORIZED),
    connection: z.string().min(1).default(CHAT_ERRORS.CONNECTION),
    processing: z.string().min(1).default(CHAT_ERRORS.PROCESSING),
    invalidModel: z.string().min(1).default(CHAT_ERRORS.INVALID_MODEL),
    imageGenIncompatible: z.string().min(1).default(CHAT_ERRORS.IMAGE_GEN_INCOMPATIBLE),
    rateLimited: z.string().min(1).default(RATE_LIMITS.ERROR_MESSAGE),
    providerUnavailable: z.string().min(1).default(CHAT_ERRORS.PROVIDER_UNAVAILABLE),
  })
  .default({})

const RuntimePromptsSchema = z
  .object({
    routerSystem: z.string().min(1).default('Route user requests to the best model.'),
    chatSystem: z.string().min(1).default('Be helpful and concise.'),
    a2uiSystem: z.string().min(1).default(PROMPTS.A2UI_SYSTEM_PROMPT),
    titleSystem: z.string().min(1).default(PROMPTS.TITLE_GENERATION_PROMPT),
    wrappers: z
      .object({
        userRequestOpen: z.string().min(1).default(USER_REQUEST_DELIMITERS.OPEN),
        userRequestClose: z.string().min(1).default(USER_REQUEST_DELIMITERS.CLOSE),
        messageOpen: z.string().min(1).default(MESSAGE_DELIMITERS.MESSAGE_OPEN),
        messageClose: z.string().min(1).default(MESSAGE_DELIMITERS.MESSAGE_CLOSE),
        searchResultsOpen: z.string().min(1).default(MESSAGE_DELIMITERS.SEARCH_RESULTS_OPEN),
        searchResultsClose: z.string().min(1).default(MESSAGE_DELIMITERS.SEARCH_RESULTS_CLOSE),
        searchResultOpen: z.string().min(1).default(MESSAGE_DELIMITERS.SEARCH_RESULT_OPEN),
        searchResultClose: z.string().min(1).default(MESSAGE_DELIMITERS.SEARCH_RESULT_CLOSE),
      })
      .default({}),
  })
  .default({})

const A2UIImagePolicySchema = z
  .object({
    allowedProtocols: z
      .array(z.enum(['https', 'data', 'relative']))
      .min(1)
      .default(['https', 'data', 'relative']),
    allowedHosts: z.array(z.string().min(1)).default([]),
  })
  .default({})

const A2UIActionPolicySchema = z
  .object({
    pattern: z.string().min(1).default('^[a-zA-Z0-9_.:\\-/]+$'),
  })
  .default({})

const RuntimeConfigObjectSchema = z.object({
  chat: z
    .object({
      stream: z
        .object({
          maxConcurrentPerConversation: z.number().int().positive().default(1),
          timeoutMs: z.number().int().positive().default(LIMITS.STREAM_TIMEOUT_MS),
          enforceSequence: z.boolean().default(true),
          retry: StreamRetryPolicySchema,
        })
        .default({}),
      statusMessages: StatusMessagesSchema,
      errors: ChatErrorsSchema,
      completion: z
        .object({
          invalidateOnDone: z.boolean().default(true),
          invalidateOnError: z.boolean().default(false),
        })
        .default({}),
    })
    .default({}),
  models: z
    .object({
      titleModel: z.string().min(1).default(MODEL_IDS.GEMINI_FLASH_LITE),
      autoRouterModel: z.string().min(1).default(MODEL_IDS.GEMINI_3_FLASH_PREVIEW),
      failurePolicy: z.enum(['retry_then_fail']).default('retry_then_fail'),
      strictValidation: z.boolean().default(true),
      registry: z
        .object({
          cacheTtlMs: z.number().int().positive().default(LIMITS.MODEL_REGISTRY_CACHE_TTL_MS),
          fetchTimeoutMs: z.number().int().positive().default(LIMITS.REGISTRY_FETCH_TIMEOUT_MS),
          staleWhileErrorMs: z.number().int().min(0).default(LIMITS.MODEL_REGISTRY_CACHE_TTL_MS),
        })
        .default({}),
    })
    .default({}),
  prompts: RuntimePromptsSchema,
  safety: z
    .object({
      escapeSearchXml: z.boolean().default(true),
      a2ui: z
        .object({
          image: A2UIImagePolicySchema,
          action: A2UIActionPolicySchema,
        })
        .default({}),
    })
    .default({}),
  limits: z
    .object({
      messageMaxLength: z.number().int().positive().default(LIMITS.MESSAGE_MAX_LENGTH),
      conversationTitleMaxLength: z
        .number()
        .int()
        .positive()
        .default(LIMITS.CONVERSATION_TITLE_MAX_LENGTH),
      fileMaxSizeBytes: z.number().int().positive().default(LIMITS.FILE_MAX_SIZE_BYTES),
      supportedFileTypes: z
        .array(z.string().min(1))
        .min(1)
        .default([...SUPPORTED_FILE_TYPES]),
      paginationDefaultLimit: z.number().int().positive().default(LIMITS.PAGINATION_DEFAULT_LIMIT),
      paginationMaxLimit: z.number().int().positive().default(LIMITS.PAGINATION_MAX_LIMIT),
      searchMaxResults: z.number().int().positive().default(LIMITS.SEARCH_MAX_RESULTS),
      uploadUrlExpiryMs: z.number().int().positive().default(LIMITS.UPLOAD_URL_EXPIRY_MS),
      rateLimit: z
        .object({
          chatPerMinute: z.number().int().positive().default(RATE_LIMITS.CHAT_PER_MINUTE),
          uploadPerMinute: z.number().int().positive().default(RATE_LIMITS.UPLOAD_PER_MINUTE),
          windowMs: z.number().int().positive().default(RATE_LIMITS.WINDOW_MS),
        })
        .default({}),
    })
    .default({}),
  ai: z
    .object({
      routerMaxTokens: z.number().int().positive().default(AI_PARAMS.ROUTER_MAX_TOKENS),
      titleMaxTokens: z.number().int().positive().default(AI_PARAMS.TITLE_MAX_TOKENS),
      routerTemperature: z.number().min(0).default(AI_PARAMS.ROUTER_TEMPERATURE),
      titleTemperature: z.number().min(0).default(AI_PARAMS.TITLE_TEMPERATURE),
    })
    .default({}),
  search: z
    .object({
      defaultDepth: z.enum(['basic', 'advanced']).default(SEARCH_DEPTHS.BASIC),
      includeImagesByDefault: z.boolean().default(false),
      toolName: z.string().min(1).default(TOOL_NAMES.WEB_SEARCH),
    })
    .default({}),
  ux: z
    .object({
      autoScrollThreshold: z.number().int().min(0).default(UX.AUTO_SCROLL_THRESHOLD),
      thinkingCollapseDefault: z.boolean().default(UX.THINKING_COLLAPSE_DEFAULT),
      copyFeedbackDurationMs: z.number().int().positive().default(UX.COPY_FEEDBACK_DURATION_MS),
    })
    .default({}),
  features: z
    .object({
      searchEnabled: z.boolean().default(true),
      a2uiEnabled: z.boolean().default(true),
    })
    .default({}),
})

export const RuntimeConfigSchema = RuntimeConfigObjectSchema.default({})

export const RuntimeConfigOverrideSchema = RuntimeConfigObjectSchema.deepPartial()

export const InvalidateRuntimeConfigInputSchema = z
  .object({ userScoped: z.boolean().default(false) })
  .default({ userScoped: false })

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>
export type RuntimeConfigOverride = z.infer<typeof RuntimeConfigOverrideSchema>
export type RuntimeA2UIPolicy = RuntimeConfig['safety']['a2ui']
export type InvalidateRuntimeConfigInput = z.infer<typeof InvalidateRuntimeConfigInputSchema>
