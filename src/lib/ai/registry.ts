import type { ModelConfig } from '@/schemas/model'
import {
  LIMITS,
  MODEL_CATEGORIES,
  MODEL_REGISTRY_CACHE_KEY,
  EXTERNAL_URLS,
} from '@/config/constants'
import { ModelConfigSchema } from '@/schemas/model'
import { env } from '@/config/env'

type OpenRouterModel = {
  id: string
  name: string
  context_length?: number
  architecture?: { modality?: string; tokenizer?: string }
  pricing?: { prompt?: string; completion?: string }
  supported_parameters?: string[]
}

type CacheEntry = { models: ModelConfig[]; fetchedAt: number }

const cache = new Map<string, CacheEntry>()

async function fetchFromOpenRouter(): Promise<ModelConfig[]> {
  const response = await fetch(EXTERNAL_URLS.OPENROUTER_MODELS, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  })

  if (!response.ok) {
    throw new Error(`OpenRouter registry fetch failed: ${response.status}`)
  }

  const json = (await response.json()) as { data: OpenRouterModel[] }

  const models: ModelConfig[] = []
  for (const raw of json.data) {
    const provider = raw.id.split('/')[0] ?? 'unknown'
    const params = raw.supported_parameters ?? []

    const parsed = ModelConfigSchema.safeParse({
      id: raw.id,
      name: raw.name,
      provider,
      capabilities: [MODEL_CATEGORIES.GENERAL],
      contextWindow: raw.context_length ?? 0,
      supportsVision: raw.architecture?.modality?.includes('image') ?? false,
      supportsTools: params.includes('tools'),
      supportsThinking: params.includes('reasoning'),
      pricing: {
        promptPerMillion: parseFloat(raw.pricing?.prompt ?? '0') * 1_000_000,
        completionPerMillion: parseFloat(raw.pricing?.completion ?? '0') * 1_000_000,
      },
    })
    if (parsed.success) models.push(parsed.data)
  }
  return models
}

export async function getModelRegistry(): Promise<ModelConfig[]> {
  const cached = cache.get(MODEL_REGISTRY_CACHE_KEY)

  if (cached && Date.now() - cached.fetchedAt < LIMITS.MODEL_REGISTRY_CACHE_TTL_MS) {
    return cached.models
  }

  try {
    const models = await fetchFromOpenRouter()
    cache.set(MODEL_REGISTRY_CACHE_KEY, { models, fetchedAt: Date.now() })
    return models
  } catch (err) {
    if (cached) return cached.models
    throw err
  }
}
