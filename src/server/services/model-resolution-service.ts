import { AI_REASONING, LIMITS, RESPONSE_FORMATS, TRPC_CODES } from '@/config/constants'
import type { db } from '@/lib/db/client'
import { conversations, userPreferences } from '@/lib/db/schema'
import { AppError } from '@/lib/utils/errors'
import type { ChatMode } from '@/schemas/message'
import type {
  ModelConfig,
  ModelResponseFormat,
  ModelSelectionSource,
  RouterFactor,
} from '@/schemas/model'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'

type ResolvedModelDecision = {
  selectedModel: string
  source: ModelSelectionSource
  reasoning: string
  category?: ModelConfig['capabilities'][number]
  confidence?: number
  factors: RouterFactor[]
  responseFormat: ModelResponseFormat
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

const ROUTER_MAX_ATTEMPTS = LIMITS.ROUTER_MAX_ATTEMPTS

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
  responseFormat: ModelResponseFormat
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
    {
      key: 'response_format',
      label: 'Response Format',
      value: params.responseFormat,
    },
  ]
}

async function resolveResponseFormat(
  input: ResolveModelDecisionInput,
  initialFormat: ModelResponseFormat,
): Promise<ModelResponseFormat> {
  if (!input.runtimeConfig.features.a2uiEnabled) {
    return RESPONSE_FORMATS.MARKDOWN
  }

  if (initialFormat === RESPONSE_FORMATS.A2UI) {
    return initialFormat
  }

  try {
    const { decideResponseFormat } = await import('@/lib/ai/router')
    return await decideResponseFormat(
      input.prompt,
      input.registry,
      input.runtimeConfig,
      input.signal,
    )
  } catch {
    return initialFormat
  }
}

export async function resolveModelDecision(
  input: ResolveModelDecisionInput,
): Promise<ResolvedModelDecision> {
  const { source, modelId } = await resolveSourceModel(input)

  if (source !== 'auto_router' && modelId) {
    const model = findModelById(input.registry, modelId)
    ensureSearchCompatible(model, input.requestedWebSearchEnabled)
    const responseFormat = await resolveResponseFormat(input, RESPONSE_FORMATS.MARKDOWN)
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
        responseFormat,
      }),
      responseFormat,
      requiresSearch: input.requestedWebSearchEnabled,
      requestedMode: input.requestedMode,
      confidence: 1,
    }
  }

  const requiresSearch = input.requestedWebSearchEnabled

  const { routeModel, adjudicateModelSelection } = await import('@/lib/ai/router')
  const attemptErrors: string[] = []

  for (let attempt = 1; attempt <= ROUTER_MAX_ATTEMPTS; attempt += 1) {
    try {
      const selection = await routeModel(
        input.prompt,
        input.registry,
        input.runtimeConfig,
        requiresSearch,
        input.signal,
      )

      let effectiveSelection = selection
      try {
        const reviewed = await adjudicateModelSelection(
          input.prompt,
          selection,
          input.registry,
          input.runtimeConfig,
          requiresSearch,
          input.signal,
        )
        const reviewValue =
          reviewed.selectedModel === selection.selectedModel
            ? 'confirmed'
            : `corrected_to:${reviewed.selectedModel}`
        effectiveSelection = {
          ...selection,
          selectedModel: reviewed.selectedModel,
          reasoning: reviewed.reasoning,
          confidence:
            typeof reviewed.confidence === 'number' ? reviewed.confidence : selection.confidence,
          factors: [
            ...selection.factors,
            {
              key: 'selection_review',
              label: 'Selection Review',
              value: reviewValue,
            },
          ],
        }
      } catch (reviewError) {
        const message = reviewError instanceof Error ? reviewError.message : String(reviewError)
        console.error('[router] selection adjudication failed:', message)
      }

      const selectedModel = findModelById(input.registry, effectiveSelection.selectedModel)
      ensureSearchCompatible(selectedModel, requiresSearch)
      const responseFormat = await resolveResponseFormat(input, effectiveSelection.responseFormat)
      const baseFactors = buildFactors({
        source: 'auto_router',
        selectedModel: selectedModel.id,
        requestedMode: input.requestedMode,
        requiresSearch,
        responseFormat,
      })
      const knownFactorKeys = new Set(baseFactors.map((factor) => factor.key))
      const mergedFactors = [
        ...baseFactors,
        ...effectiveSelection.factors.filter((factor) => !knownFactorKeys.has(factor.key)),
      ]

      return {
        selectedModel: selectedModel.id,
        source: 'auto_router',
        reasoning: effectiveSelection.reasoning || AI_REASONING.MODEL_AUTO_ROUTER,
        category: effectiveSelection.category,
        confidence: effectiveSelection.confidence,
        factors: mergedFactors,
        responseFormat,
        requiresSearch,
        requestedMode: input.requestedMode,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      attemptErrors.push(`attempt_${attempt}:${message}`)
      console.error(`[router] auto router failed on attempt ${attempt}:`, message)
    }
  }

  console.error('[router] auto router exhausted retries:', attemptErrors.join(' | '))

  const fallbackModel = requiresSearch
    ? input.registry.find((m) => m.supportsTools)
    : input.registry[0]

  if (!fallbackModel) {
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: AppError.ROUTER_FAILED,
    })
  }

  console.warn('[router] falling back to model:', fallbackModel.id)
  const responseFormat = await resolveResponseFormat(input, RESPONSE_FORMATS.MARKDOWN)
  return {
    selectedModel: fallbackModel.id,
    source: 'auto_router',
    reasoning: AI_REASONING.MODEL_AUTO_ROUTER_FALLBACK,
    confidence: 0,
    factors: [
      ...buildFactors({
        source: 'auto_router',
        selectedModel: fallbackModel.id,
        requestedMode: input.requestedMode,
        requiresSearch,
        responseFormat,
      }),
      {
        key: 'router_fallback',
        label: 'Router Fallback',
        value: `exhausted_${ROUTER_MAX_ATTEMPTS}_attempts`,
      },
    ],
    responseFormat,
    requiresSearch,
    requestedMode: input.requestedMode,
  }
}
