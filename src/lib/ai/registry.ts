import type { ModelConfig } from '@/schemas/model'
import {
  MODEL_CATEGORIES,
  MODEL_REGISTRY_CACHE_KEY,
  EXTERNAL_URLS,
  PROVIDERS,
} from '@/config/constants'
import { ModelConfigSchema } from '@/schemas/model'
import { env } from '@/config/env'
import { getRuntimeConfig } from '@/lib/runtime-config/service'
import type { RuntimeConfig } from '@/schemas/runtime-config'

type OpenRouterModel = {
  id: string
  name: string
  context_length?: number
  architecture?: { modality?: string; tokenizer?: string }
  pricing?: { prompt?: string; completion?: string }
  supported_parameters?: string[]
}

type CacheEntry = { models: ModelConfig[]; fetchedAt: number }

type ModelRegistryOptions = {
  force?: boolean
  runtimeConfig?: RuntimeConfig
  userId?: string
}

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

async function fetchFromOpenRouter(runtimeConfig: RuntimeConfig): Promise<ModelConfig[]> {
  const response = await fetch(EXTERNAL_URLS.OPENROUTER_MODELS, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
    signal: AbortSignal.timeout(runtimeConfig.models.registry.fetchTimeoutMs),
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
    if (parsed.success) {
      models.push(parsed.data)
    }
  }

  if (models.length === 0) {
    throw new Error('OpenRouter registry returned no valid models.')
  }
  return models
}

export function clearModelRegistryCache(): void {
  cache.delete(MODEL_REGISTRY_CACHE_KEY)
}

export async function getModelRegistry(options: ModelRegistryOptions = {}): Promise<ModelConfig[]> {
  const runtimeConfig =
    options.runtimeConfig ??
    (await getRuntimeConfig(options.userId ? { userId: options.userId } : {}))
  const cached = cache.get(MODEL_REGISTRY_CACHE_KEY)
  const now = Date.now()

  if (
    !options.force &&
    cached &&
    now - cached.fetchedAt < runtimeConfig.models.registry.cacheTtlMs
  ) {
    return cached.models
  }

  try {
    const models = await fetchFromOpenRouter(runtimeConfig)
    cache.set(MODEL_REGISTRY_CACHE_KEY, { models, fetchedAt: now })
    return models
  } catch (error) {
    if (
      cached &&
      now - cached.fetchedAt <=
        runtimeConfig.models.registry.cacheTtlMs + runtimeConfig.models.registry.staleWhileErrorMs
    ) {
      return cached.models
    }
    console.error('[registry] OpenRouter fetch failed:', error)
    throw error
  }
}
