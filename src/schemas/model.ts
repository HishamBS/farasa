import { z } from 'zod'
import { MODEL_CATEGORIES, PROVIDERS } from '@/config/constants'

export const ModelCapabilitySchema = z.enum([
  MODEL_CATEGORIES.CODE,
  MODEL_CATEGORIES.ANALYSIS,
  MODEL_CATEGORIES.CREATIVE,
  MODEL_CATEGORIES.VISION,
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

export const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  capabilities: z.array(ModelCapabilitySchema),
  contextWindow: z.number().int().positive(),
  supportsVision: z.boolean(),
  supportsTools: z.boolean(),
  supportsThinking: z.boolean().default(false),
  pricing: ModelPricingSchema,
})

export const ModelSelectionSchema = z.object({
  category: ModelCapabilitySchema,
  reasoning: z.string(),
  selectedModel: z.string(),
})

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
export type ModelById = z.infer<typeof ModelByIdSchema>
export type RefreshModels = z.infer<typeof RefreshModelsSchema>
