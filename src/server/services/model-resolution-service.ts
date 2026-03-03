import { AI_REASONING, MODEL_CATEGORIES, TRPC_CODES } from '@/config/constants'
import type { db } from '@/lib/db/client'
import { conversations, userPreferences } from '@/lib/db/schema'
import { AppError } from '@/lib/utils/errors'
import type { ChatMode } from '@/schemas/message'
import type { ModelConfig, ModelSelectionSource } from '@/schemas/model'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'

type RouterFactor = {
  key: string
  label: string
  value: string
}

type ResolvedModelDecision = {
  selectedModel: string
  source: ModelSelectionSource
  reasoning: string
  category?: ModelConfig['capabilities'][number]
  confidence?: number
  factors: RouterFactor[]
  requiresSearch: boolean
  requestedMode: ChatMode
}

type ResolveModelDecisionInput = {
  dbClient: typeof db
  userId: string
  conversationId: string
  requestedModel?: string | null
  requestedMode: ChatMode
  requestedWebSearchEnabled: boolean
  prompt: string
  registry: ReadonlyArray<ModelConfig>
  runtimeConfig: RuntimeConfig
  signal: AbortSignal
}

const ROUTER_FALLBACK_FACTOR_VALUE_MAX_LENGTH = 120
const ROUTER_FALLBACK_COMPLEX_PROMPT_MIN_CHARS = 220
const ROUTER_COMPLEXITY_HINTS = [
  'analyze',
  'architecture',
  'compare',
  'debug',
  'design',
  'evaluate',
  'explain',
  'optimize',
  'strategy',
] as const

function findModelById(registry: ReadonlyArray<ModelConfig>, modelId: string): ModelConfig {
  const model = registry.find((entry) => entry.id === modelId)
  if (!model) {
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: AppError.INVALID_MODEL,
    })
  }
  return model
}

function ensureSearchCompatible(model: ModelConfig, requiresSearch: boolean): void {
  if (requiresSearch && !model.supportsTools) {
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: AppError.INVALID_MODEL,
    })
  }
}

async function resolveSourceModel(input: ResolveModelDecisionInput): Promise<{
  modelId?: string
  source: ModelSelectionSource
}> {
  const { dbClient, userId, conversationId, requestedModel } = input
  if (requestedModel === null) {
    return { source: 'auto_router' }
  }

  if (typeof requestedModel === 'string') {
    return { modelId: requestedModel, source: 'explicit_request' }
  }

  const [conversation] = await dbClient
    .select({ model: conversations.model })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)

  if (conversation?.model) {
    return { modelId: conversation.model, source: 'conversation_default' }
  }

  const [preferences] = await dbClient
    .select({ defaultModel: userPreferences.defaultModel })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  if (preferences?.defaultModel) {
    return { modelId: preferences.defaultModel, source: 'user_default' }
  }

  return { source: 'auto_router' }
}

function buildFactors(params: {
  source: ModelSelectionSource
  selectedModel: string
  requestedMode: ChatMode
  requiresSearch: boolean
}): RouterFactor[] {
  return [
    {
      key: 'selection_source',
      label: 'Selection Source',
      value: params.source,
    },
    {
      key: 'execution_mode',
      label: 'Execution Mode',
      value: params.requestedMode,
    },
    {
      key: 'tool_requirement',
      label: 'Web Search Requirement',
      value: params.requiresSearch ? 'required' : 'not_required',
    },
    {
      key: 'selected_model',
      label: 'Selected Model',
      value: params.selectedModel,
    },
  ]
}

function truncateFactorValue(value: string): string {
  if (value.length <= ROUTER_FALLBACK_FACTOR_VALUE_MAX_LENGTH) return value
  return `${value.slice(0, ROUTER_FALLBACK_FACTOR_VALUE_MAX_LENGTH - 1)}…`
}

function isComplexPrompt(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase()
  if (normalized.length >= ROUTER_FALLBACK_COMPLEX_PROMPT_MIN_CHARS) return true
  return ROUTER_COMPLEXITY_HINTS.some((hint) => normalized.includes(hint))
}

function selectAutoRouterFallbackModel(input: ResolveModelDecisionInput): ModelConfig {
  const requiresSearch = input.requestedWebSearchEnabled
  const complexPrompt = isComplexPrompt(input.prompt)

  const compatible = input.registry.filter((model) => (requiresSearch ? model.supportsTools : true))
  if (compatible.length === 0) {
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: AppError.ROUTER_FAILED,
    })
  }

  const sorted = [...compatible].sort((a, b) => {
    if (complexPrompt && a.supportsThinking !== b.supportsThinking) {
      return a.supportsThinking ? -1 : 1
    }
    if (!complexPrompt) {
      const aFast = a.capabilities.includes(MODEL_CATEGORIES.FAST)
      const bFast = b.capabilities.includes(MODEL_CATEGORIES.FAST)
      if (aFast !== bFast) return aFast ? -1 : 1
    }

    if (a.contextWindow !== b.contextWindow) return b.contextWindow - a.contextWindow
    if (a.supportsTools !== b.supportsTools) return a.supportsTools ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  const selected = sorted[0]
  if (!selected) {
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: AppError.ROUTER_FAILED,
    })
  }
  return selected
}

export async function resolveModelDecision(
  input: ResolveModelDecisionInput,
): Promise<ResolvedModelDecision> {
  const { source, modelId } = await resolveSourceModel(input)

  if (source !== 'auto_router' && modelId) {
    const model = findModelById(input.registry, modelId)
    ensureSearchCompatible(model, input.requestedWebSearchEnabled)
    return {
      selectedModel: model.id,
      source,
      reasoning:
        source === 'explicit_request'
          ? AI_REASONING.MODEL_EXPLICIT
          : source === 'conversation_default'
            ? AI_REASONING.MODEL_CONVERSATION_DEFAULT
            : AI_REASONING.MODEL_USER_DEFAULT,
      factors: buildFactors({
        source,
        selectedModel: model.id,
        requestedMode: input.requestedMode,
        requiresSearch: input.requestedWebSearchEnabled,
      }),
      requiresSearch: input.requestedWebSearchEnabled,
      requestedMode: input.requestedMode,
      confidence: 1,
    }
  }

  const requiresSearch = input.requestedWebSearchEnabled

  try {
    const { routeModel } = await import('@/lib/ai/router')
    const selection = await routeModel(
      input.prompt,
      input.registry,
      input.runtimeConfig,
      requiresSearch,
      input.signal,
    )

    const selectedModel = findModelById(input.registry, selection.selectedModel)
    ensureSearchCompatible(selectedModel, requiresSearch)

    return {
      selectedModel: selectedModel.id,
      source: 'auto_router',
      reasoning: selection.reasoning || AI_REASONING.MODEL_AUTO_ROUTER,
      category: selection.category,
      confidence: selection.confidence,
      factors: selection.factors,
      requiresSearch,
      requestedMode: input.requestedMode,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[router] auto router failed, using deterministic fallback:', errorMessage)
    const fallbackModel = selectAutoRouterFallbackModel(input)

    return {
      selectedModel: fallbackModel.id,
      source: 'auto_router',
      reasoning: AI_REASONING.MODEL_AUTO_ROUTER_FALLBACK,
      confidence: 0.6,
      factors: [
        ...buildFactors({
          source: 'auto_router',
          selectedModel: fallbackModel.id,
          requestedMode: input.requestedMode,
          requiresSearch,
        }),
        {
          key: 'router_path',
          label: 'Router Path',
          value: 'deterministic_fallback',
        },
        {
          key: 'fallback_trigger',
          label: 'Fallback Trigger',
          value: truncateFactorValue(errorMessage),
        },
      ],
      requiresSearch,
      requestedMode: input.requestedMode,
    }
  }
}
