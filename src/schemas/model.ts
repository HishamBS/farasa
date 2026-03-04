import { MODEL_CATEGORIES, PROVIDERS, PROVIDER_ALIASES, RESPONSE_FORMATS } from '@/config/constants'
import { extractProviderKey } from '@/lib/utils/model'
import { z } from 'zod'

export const ModelCapabilitySchema = z.enum([
  MODEL_CATEGORIES.CODE,
  MODEL_CATEGORIES.ANALYSIS,
  MODEL_CATEGORIES.CREATIVE,
  MODEL_CATEGORIES.VISION,
  MODEL_CATEGORIES.IMAGE_GENERATION,
  MODEL_CATEGORIES.GENERAL,
  MODEL_CATEGORIES.FAST,
])

export const ProviderSchema = z.enum([
  PROVIDERS.OPENAI,
  PROVIDERS.ANTHROPIC,
  PROVIDERS.GOOGLE,
  PROVIDERS.META,
  PROVIDERS.GROQ,
  PROVIDERS.CEREBRAS,
])

export const ModelPricingSchema = z.object({
  promptPerMillion: z.number().nonnegative(),
  completionPerMillion: z.number().nonnegative(),
})

export const ModelConfigSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    capabilities: z.array(ModelCapabilitySchema),
    contextWindow: z.number().int().positive(),
    supportsVision: z.boolean(),
    supportsTools: z.boolean(),
    supportsThinking: z.boolean().default(false),
    supportsImageGeneration: z.boolean().default(false),
    maxCompletionTokens: z.number().int().min(0).default(0),
    pricing: ModelPricingSchema,
  })
  .transform((raw) => {
    const rawProvider = extractProviderKey(raw.id)
    return { ...raw, provider: PROVIDER_ALIASES[rawProvider] ?? rawProvider }
  })

export const RouterFactorSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
})

export const ModelSelectionSchema = z.object({
  category: ModelCapabilitySchema,
  reasoning: z.string(),
  selectedModel: z.string(),
  responseFormat: z
    .enum([RESPONSE_FORMATS.MARKDOWN, RESPONSE_FORMATS.A2UI])
    .default(RESPONSE_FORMATS.MARKDOWN),
  confidence: z.number().min(0).max(1),
  factors: z.array(RouterFactorSchema).min(1),
})

export const ModelSelectionSourceSchema = z.enum([
  'explicit_request',
  'conversation_default',
  'user_default',
  'auto_router',
])

export const ModelResponseFormatSchema = z.enum([RESPONSE_FORMATS.MARKDOWN, RESPONSE_FORMATS.A2UI])

export const ModelByIdSchema = z.object({
  id: z.string(),
})

export const RefreshModelsSchema = z.object({
  force: z.boolean().default(true),
})

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>
export type Provider = z.infer<typeof ProviderSchema>
export type ModelPricing = z.infer<typeof ModelPricingSchema>
export type ModelConfig = z.infer<typeof ModelConfigSchema>
export type ModelSelection = z.infer<typeof ModelSelectionSchema>
export type ModelSelectionSource = z.infer<typeof ModelSelectionSourceSchema>
export type RouterFactor = z.infer<typeof RouterFactorSchema>
export type ModelResponseFormat = z.infer<typeof ModelResponseFormatSchema>
export type ModelById = z.infer<typeof ModelByIdSchema>
export type RefreshModels = z.infer<typeof RefreshModelsSchema>
