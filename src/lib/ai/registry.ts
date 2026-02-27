import type { ModelConfig } from '@/schemas/model'
import {
  LIMITS,
  MODEL_CATEGORIES,
  MODEL_REGISTRY_CACHE_KEY,
  EXTERNAL_URLS,
  PROVIDERS,
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

function normalizeProvider(rawProvider: string): ModelConfig['provider'] | null {
  switch (rawProvider) {
    case PROVIDERS.OPENAI:
      return PROVIDERS.OPENAI
    case PROVIDERS.ANTHROPIC:
      return PROVIDERS.ANTHROPIC
    case PROVIDERS.GOOGLE:
      return PROVIDERS.GOOGLE
    case PROVIDERS.GROQ:
      return PROVIDERS.GROQ
    case PROVIDERS.CEREBRAS:
      return PROVIDERS.CEREBRAS
    case PROVIDERS.META:
    case 'meta-llama':
      return PROVIDERS.META
    default:
      return null
  }
}

async function fetchFromOpenRouter(): Promise<ModelConfig[]> {
  const response = await fetch(EXTERNAL_URLS.OPENROUTER_MODELS, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
    signal: AbortSignal.timeout(LIMITS.REGISTRY_FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter registry fetch failed: ${response.status}`)
  }

  const json = (await response.json()) as { data: OpenRouterModel[] }

  const models: ModelConfig[] = []
  for (const raw of json.data) {
    const providerId = raw.id.split('/')[0] ?? ''
    const provider = normalizeProvider(providerId)
    if (!provider) continue
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
  if (models.length === 0) {
    throw new Error('OpenRouter registry returned no valid models.')
  }
  return models
}

export function clearModelRegistryCache(): void {
  cache.delete(MODEL_REGISTRY_CACHE_KEY)
}

export async function getModelRegistry(force = false): Promise<ModelConfig[]> {
  const cached = cache.get(MODEL_REGISTRY_CACHE_KEY)

  if (
    !force &&
    cached &&
    Date.now() - cached.fetchedAt < LIMITS.MODEL_REGISTRY_CACHE_TTL_MS
  ) {
    return cached.models
  }

  const models = await fetchFromOpenRouter()
  cache.set(MODEL_REGISTRY_CACHE_KEY, { models, fetchedAt: Date.now() })
  return models
}
