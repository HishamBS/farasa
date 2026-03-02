import { openrouter } from './client'
import { ModelSelectionSchema, RouterSearchDecisionSchema } from '@/schemas/model'
import { buildRouterPrompt, buildSearchClassifierPrompt } from '@/config/prompts'
import type {
  ModelSelection,
  ModelConfig,
  ModelCapability,
  RouterSearchDecision,
} from '@/schemas/model'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import { MODEL_CATEGORIES, MODEL_IDS } from '@/config/constants'

type RawRouterSelection = {
  category?: unknown
  reasoning?: unknown
  selectedModel?: unknown
  requiresSearch?: unknown
}

function normalizeRouterSelection(raw: RawRouterSelection): RawRouterSelection {
  if (typeof raw.requiresSearch === 'string') {
    const normalized = raw.requiresSearch.trim().toLowerCase()
    if (normalized === 'true') {
      return { ...raw, requiresSearch: true }
    }
    if (normalized === 'false') {
      return { ...raw, requiresSearch: false }
    }
  }
  return raw
}

function selectRoutingEngineModel(registry: ReadonlyArray<ModelConfig>): string {
  const requiredRouterModelId = MODEL_IDS.GEMINI_3_FLASH_PREVIEW
  const required = registry.find((model) => model.id === requiredRouterModelId)
  if (!required) {
    throw new Error(`[router] Required router model is unavailable: ${requiredRouterModelId}`)
  }
  return required.id
}

function hasCategory(model: ModelConfig, category: ModelCapability): boolean {
  switch (category) {
    case MODEL_CATEGORIES.VISION:
      return model.supportsVision
    case MODEL_CATEGORIES.ANALYSIS:
      return model.supportsThinking || model.capabilities.includes(MODEL_CATEGORIES.ANALYSIS)
    case MODEL_CATEGORIES.CODE:
      return model.capabilities.includes(MODEL_CATEGORIES.CODE)
    case MODEL_CATEGORIES.CREATIVE:
      return model.capabilities.includes(MODEL_CATEGORIES.CREATIVE)
    case MODEL_CATEGORIES.FAST:
      return model.capabilities.includes(MODEL_CATEGORIES.FAST)
    case MODEL_CATEGORIES.GENERAL:
      return true
  }
}

function validateModelSelection(
  selection: ModelSelection,
  registry: ReadonlyArray<ModelConfig>,
): ModelSelection {
  const selectedModel = registry.find((model) => model.id === selection.selectedModel)
  if (!selectedModel) {
    throw new Error(`[router] Selected model is unavailable: ${selection.selectedModel}`)
  }

  if (!hasCategory(selectedModel, selection.category)) {
    throw new Error(
      `[router] Selected model does not satisfy category ${selection.category}: ${selection.selectedModel}`,
    )
  }

  if (selection.requiresSearch && !selectedModel.supportsTools) {
    throw new Error(
      `[router] Selected model does not support tools for search-required request: ${selection.selectedModel}`,
    )
  }

  return selection
}

export async function routeModel(
  prompt: string,
  registry: ReadonlyArray<ModelConfig>,
  runtimeConfig: RuntimeConfig,
  signal?: AbortSignal,
): Promise<ModelSelection> {
  const routingModelId = selectRoutingEngineModel(registry)
  const systemPrompt = buildRouterPrompt(registry)

  const wrappedPrompt =
    `${runtimeConfig.prompts.wrappers.userRequestOpen}\n` +
    `${prompt}\n` +
    `${runtimeConfig.prompts.wrappers.userRequestClose}`

  const response = await openrouter.chat.send(
    {
      chatGenerationParams: {
        model: routingModelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: wrappedPrompt },
        ],
        responseFormat: { type: 'json_object' },
        maxTokens: runtimeConfig.ai.routerMaxTokens,
        temperature: runtimeConfig.ai.routerTemperature,
      },
    },
    { signal },
  )

  const raw = response.choices[0]?.message.content
  if (typeof raw !== 'string') throw new Error('[router] No content in routing model response')
  const parsed = ModelSelectionSchema.parse(
    normalizeRouterSelection(JSON.parse(raw) as RawRouterSelection),
  )
  return validateModelSelection(parsed, registry)
}

export async function classifySearchRequirement(
  prompt: string,
  registry: ReadonlyArray<ModelConfig>,
  runtimeConfig: RuntimeConfig,
  signal?: AbortSignal,
): Promise<RouterSearchDecision> {
  const routingModelId = selectRoutingEngineModel(registry)
  const systemPrompt = buildSearchClassifierPrompt()
  const wrappedPrompt =
    `${runtimeConfig.prompts.wrappers.userRequestOpen}\n` +
    `${prompt}\n` +
    `${runtimeConfig.prompts.wrappers.userRequestClose}`

  const response = await openrouter.chat.send(
    {
      chatGenerationParams: {
        model: routingModelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: wrappedPrompt },
        ],
        responseFormat: { type: 'json_object' },
        maxTokens: runtimeConfig.ai.routerMaxTokens,
        temperature: runtimeConfig.ai.routerTemperature,
      },
    },
    { signal },
  )

  const raw = response.choices[0]?.message.content
  if (typeof raw !== 'string') {
    throw new Error('[router] No content in search classifier response')
  }
  return RouterSearchDecisionSchema.parse(JSON.parse(raw) as unknown)
}
