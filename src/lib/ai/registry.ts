import type { ModelConfig } from '@/schemas/model'
import type { ModelCapability } from '@/schemas/model'
import {
  MODEL_CATEGORIES,
  MODEL_REGISTRY_CACHE_KEY,
  EXTERNAL_URLS,
  PROVIDERS,
  ROUTER_CAPABILITY_PATTERNS,
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

function inferCapabilities(model: OpenRouterModel): ModelCapability[] {
  const id = model.id.toLowerCase()
  const name = (model.name ?? '').toLowerCase()
  const params = model.supported_parameters ?? []
  const supportsVision = model.architecture?.modality?.includes('image') ?? false
  const supportsThinking = params.includes('reasoning')

  const caps = new Set<ModelCapability>()

  if (ROUTER_CAPABILITY_PATTERNS.CODE.some((p) => id.includes(p) || name.includes(p))) {
    caps.add(MODEL_CATEGORIES.CODE)
  }

  if (supportsThinking) {
    caps.add(MODEL_CATEGORIES.ANALYSIS)
  }

  if (supportsVision) {
    caps.add(MODEL_CATEGORIES.VISION)
  }

  if (ROUTER_CAPABILITY_PATTERNS.FAST.some((p) => id.includes(p) || name.includes(p))) {
    caps.add(MODEL_CATEGORIES.FAST)
  }

  if (ROUTER_CAPABILITY_PATTERNS.ANALYSIS.some((p) => id.includes(p))) {
    caps.add(MODEL_CATEGORIES.ANALYSIS)
  }

  if (caps.size === 0) {
    caps.add(MODEL_CATEGORIES.GENERAL)
  }

  return Array.from(caps)
}

type CacheEntry = { models: ModelConfig[]; fetchedAt: number }

type ModelRegistryOptions = {
  force?: boolean
  runtimeConfig?: RuntimeConfig
  userId?: string
}

const cache = new Map<string, CacheEntry>()

function normalizeProvider(rawProvider: string): string {
  if (rawProvider === 'meta-llama') return PROVIDERS.META
  return rawProvider
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
    const params = raw.supported_parameters ?? []

    const supportsVision = raw.architecture?.modality?.includes('image') ?? false
    const supportsThinking = params.includes('reasoning')
    const parsed = ModelConfigSchema.safeParse({
      id: raw.id,
      name: raw.name,
      provider,
      capabilities: inferCapabilities(raw),
      contextWindow: raw.context_length ?? 0,
      supportsVision,
      supportsTools: params.includes('tools'),
      supportsThinking,
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
