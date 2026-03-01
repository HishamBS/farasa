import { z } from 'zod'
import { MODEL_IDS } from '@/config/constants'

const StreamRetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(0),
  baseDelayMs: z.number().int().min(0),
  maxDelayMs: z.number().int().positive(),
  jitterMs: z.number().int().min(0),
})

const StatusMessagesSchema = z.object({
  routing: z.string().min(1),
  thinking: z.string().min(1),
  searching: z.string().min(1),
  readingFiles: z.string().min(1),
  generatingUi: z.string().min(1),
  generatingTitle: z.string().min(1),
})

const ChatErrorsSchema = z.object({
  unauthorized: z.string().min(1),
  connection: z.string().min(1),
  processing: z.string().min(1),
  invalidModel: z.string().min(1),
  rateLimited: z.string().min(1),
  providerUnavailable: z.string().min(1),
})

const RuntimePromptsSchema = z.object({
  routerSystem: z.string().min(1),
  chatSystem: z.string().min(1),
  a2uiSystem: z.string().min(1),
  titleSystem: z.string().min(1),
  wrappers: z.object({
    userRequestOpen: z.string().min(1),
    userRequestClose: z.string().min(1),
    messageOpen: z.string().min(1),
    messageClose: z.string().min(1),
    searchResultsOpen: z.string().min(1),
    searchResultsClose: z.string().min(1),
    searchResultOpen: z.string().min(1),
    searchResultClose: z.string().min(1),
  }),
})

const A2UIImagePolicySchema = z.object({
  allowedProtocols: z.array(z.enum(['https', 'data', 'relative'])).min(1),
  allowedHosts: z.array(z.string().min(1)),
})

const A2UIActionPolicySchema = z.object({
  pattern: z.string().min(1),
})

export const RuntimeConfigSchema = z.object({
  chat: z.object({
    stream: z.object({
      maxConcurrentPerConversation: z.number().int().positive(),
      timeoutMs: z.number().int().positive(),
      enforceSequence: z.boolean(),
      retry: StreamRetryPolicySchema,
    }),
    statusMessages: StatusMessagesSchema,
    errors: ChatErrorsSchema,
    completion: z.object({
      invalidateOnDone: z.boolean(),
      invalidateOnError: z.boolean(),
    }),
  }),
  models: z.object({
    routerModel: z.string().min(1).default(MODEL_IDS.QWEN_35_A3B),
    failurePolicy: z.enum(['retry_then_fail']),
    strictValidation: z.boolean(),
    registry: z.object({
      cacheTtlMs: z.number().int().positive(),
      fetchTimeoutMs: z.number().int().positive(),
      staleWhileErrorMs: z.number().int().min(0),
    }),
  }),
  prompts: RuntimePromptsSchema,
  safety: z.object({
    escapeSearchXml: z.boolean(),
    a2ui: z.object({
      image: A2UIImagePolicySchema,
      action: A2UIActionPolicySchema,
    }),
  }),
  limits: z.object({
    messageMaxLength: z.number().int().positive(),
    conversationTitleMaxLength: z.number().int().positive(),
    fileMaxSizeBytes: z.number().int().positive(),
    supportedFileTypes: z.array(z.string().min(1)).min(1),
    paginationDefaultLimit: z.number().int().positive(),
    paginationMaxLimit: z.number().int().positive(),
    searchMaxResults: z.number().int().positive(),
    uploadUrlExpiryMs: z.number().int().positive(),
    rateLimit: z.object({
      chatPerMinute: z.number().int().positive(),
      uploadPerMinute: z.number().int().positive(),
      windowMs: z.number().int().positive(),
    }),
  }),
  ai: z.object({
    routerMaxTokens: z.number().int().positive(),
    titleMaxTokens: z.number().int().positive(),
    chatMaxTokens: z.number().int().positive(),
    routerTemperature: z.number().min(0),
    titleTemperature: z.number().min(0),
  }),
  search: z.object({
    defaultDepth: z.enum(['basic', 'advanced']),
    includeImagesByDefault: z.boolean(),
    toolName: z.string().min(1),
  }),
  ux: z.object({
    autoScrollThreshold: z.number().int().min(0),
    thinkingCollapseDefault: z.boolean(),
    copyFeedbackDurationMs: z.number().int().positive(),
  }),
  features: z.object({
    searchEnabled: z.boolean(),
    a2uiEnabled: z.boolean(),
  }),
})

export const RuntimeConfigOverrideSchema = RuntimeConfigSchema.deepPartial()

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>
export type RuntimeConfigOverride = z.infer<typeof RuntimeConfigOverrideSchema>
export type RuntimeA2UIPolicy = RuntimeConfig['safety']['a2ui']
