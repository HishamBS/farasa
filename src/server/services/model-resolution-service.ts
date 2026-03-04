import {
  AI_REASONING,
  LIMITS,
  MODEL_SELECTION_SOURCES,
  RESPONSE_FORMATS,
  TRPC_CODES,
} from '@/config/constants'
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
    return { source: MODEL_SELECTION_SOURCES.AUTO_ROUTER }
  }

  if (typeof requestedModel === 'string') {
    return { modelId: requestedModel, source: MODEL_SELECTION_SOURCES.EXPLICIT_REQUEST }
  }

  const [conversation] = await dbClient
    .select({ model: conversations.model })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)

  if (conversation?.model) {
    return { modelId: conversation.model, source: MODEL_SELECTION_SOURCES.CONVERSATION_DEFAULT }
  }

  const [preferences] = await dbClient
    .select({ defaultModel: userPreferences.defaultModel })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  if (preferences?.defaultModel) {
    return { modelId: preferences.defaultModel, source: MODEL_SELECTION_SOURCES.USER_DEFAULT }
  }

  return { source: MODEL_SELECTION_SOURCES.AUTO_ROUTER }
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

export async function resolveModelDecision(
  input: ResolveModelDecisionInput,
): Promise<ResolvedModelDecision> {
  const { source, modelId } = await resolveSourceModel(input)

  if (source !== MODEL_SELECTION_SOURCES.AUTO_ROUTER && modelId) {
    const model = findModelById(input.registry, modelId)
    ensureSearchCompatible(model, input.requestedWebSearchEnabled)
    const responseFormat = RESPONSE_FORMATS.MARKDOWN
    return {
      selectedModel: model.id,
      source,
      reasoning:
        source === MODEL_SELECTION_SOURCES.EXPLICIT_REQUEST
          ? AI_REASONING.MODEL_EXPLICIT
          : source === MODEL_SELECTION_SOURCES.CONVERSATION_DEFAULT
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

  const { routeModel } = await import('@/lib/ai/router')
  const attemptErrors: string[] = []

  for (let attempt = 1; attempt <= ROUTER_MAX_ATTEMPTS; attempt += 1) {
    const attemptSignal = AbortSignal.any([
      input.signal,
      AbortSignal.timeout(LIMITS.ROUTER_TIMEOUT_MS),
    ])
    try {
      const selection = await routeModel(
        input.prompt,
        input.registry,
        input.runtimeConfig,
        requiresSearch,
        attemptSignal,
      )

      const selectedModel = findModelById(input.registry, selection.selectedModel)
      ensureSearchCompatible(selectedModel, requiresSearch)

      const responseFormat = input.runtimeConfig.features.a2uiEnabled
        ? selection.responseFormat
        : RESPONSE_FORMATS.MARKDOWN

      const baseFactors = buildFactors({
        source: MODEL_SELECTION_SOURCES.AUTO_ROUTER,
        selectedModel: selectedModel.id,
        requestedMode: input.requestedMode,
        requiresSearch,
        responseFormat,
      })
      const knownFactorKeys = new Set(baseFactors.map((factor) => factor.key))
      const mergedFactors = [
        ...baseFactors,
        ...selection.factors.filter((factor) => !knownFactorKeys.has(factor.key)),
      ]

      return {
        selectedModel: selectedModel.id,
        source: MODEL_SELECTION_SOURCES.AUTO_ROUTER,
        reasoning: selection.reasoning || AI_REASONING.MODEL_AUTO_ROUTER,
        category: selection.category,
        confidence: selection.confidence,
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
  throw new TRPCError({
    code: TRPC_CODES.BAD_REQUEST,
    message: AppError.ROUTER_FAILED,
  })
}
