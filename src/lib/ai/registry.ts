import type { ModelConfig } from '@/schemas/model'
import { STATIC_MODELS } from '@/config/models'
import { LIMITS } from '@/config/constants'
import { ModelConfigSchema } from '@/schemas/model'
import { env } from '@/config/env'

type CacheEntry = { models: ModelConfig[]; fetchedAt: number }

const cache = new Map<string, CacheEntry>()
const CACHE_KEY = 'models'

async function fetchFromOpenRouter(): Promise<ModelConfig[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  })

  if (!response.ok) {
    throw new Error(`OpenRouter registry fetch failed: ${response.status}`)
  }

  const json = (await response.json()) as {
    data: Array<{
      id: string
      name: string
      context_length?: number
      architecture?: { modality?: string; tokenizer?: string }
      top_provider?: { is_moderated?: boolean }
      pricing?: { prompt?: string; completion?: string }
    }>
  }

  const models: ModelConfig[] = []
  for (const raw of json.data) {
    const provider = raw.id.split('/')[0] ?? 'unknown'
    const parsed = ModelConfigSchema.safeParse({
      id: raw.id,
      name: raw.name,
      provider,
      capabilities: ['general'],
      contextWindow: raw.context_length ?? 4096,
      supportsVision: raw.architecture?.modality?.includes('image') ?? false,
      supportsTools: true,
      supportsThinking: raw.id.includes('claude') && raw.id.includes('sonnet'),
      pricing: {
        promptPerMillion: parseFloat(raw.pricing?.prompt ?? '0') * 1_000_000,
        completionPerMillion:
          parseFloat(raw.pricing?.completion ?? '0') * 1_000_000,
      },
    })
    if (parsed.success) models.push(parsed.data)
  }
  return models
}

export async function getModelRegistry(): Promise<ModelConfig[]> {
  const cached = cache.get(CACHE_KEY)
  if (cached && Date.now() - cached.fetchedAt < LIMITS.MODEL_REGISTRY_CACHE_TTL_MS) {
    return cached.models
  }

  try {
    const models = await fetchFromOpenRouter()
    cache.set(CACHE_KEY, { models, fetchedAt: Date.now() })
    return models
  } catch {
    return STATIC_MODELS.map((m) => ModelConfigSchema.parse(m))
  }
}
