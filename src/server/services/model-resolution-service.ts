import { and, eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import type { ModelConfig, ModelSelectionSource } from '@/schemas/model'
import type { ChatMode } from '@/schemas/message'
import type { db } from '@/lib/db/client'
import { conversations, userPreferences } from '@/lib/db/schema'
import { AI_REASONING, TRPC_CODES } from '@/config/constants'
import { AppError } from '@/lib/utils/errors'

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

  const { routeModel } = await import('@/lib/ai/router')
  let selection: Awaited<ReturnType<typeof routeModel>>
  try {
    selection = await routeModel(
      input.prompt,
      input.registry,
      input.runtimeConfig,
      input.requestedWebSearchEnabled,
      input.signal,
    )
  } catch (error) {
    console.error(
      '[router] routeModel failed:',
      error instanceof Error ? error.message : String(error),
    )
    throw new TRPCError({
      code: TRPC_CODES.BAD_REQUEST,
      message: AppError.ROUTER_FAILED,
    })
  }

  const selectedModel = findModelById(input.registry, selection.selectedModel)
  const requiresSearch = input.requestedWebSearchEnabled
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
}
