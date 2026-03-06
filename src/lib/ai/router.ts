import { LIMITS, MESSAGE_ROLES, MODEL_CATEGORIES, RESPONSE_FORMATS } from '@/config/constants'
import { buildRouterPrompt } from '@/config/prompts'
import type { ModelConfig, ModelSelection } from '@/schemas/model'
import { ModelCapabilitySchema, ModelSelectionSchema } from '@/schemas/model'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import { openrouter } from './client'

function extractFirstJsonObject(raw: string): string {
  const start = raw.indexOf('{')
  if (start < 0) {
    throw new Error('[router] Routing model response does not contain a JSON object')
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return raw.slice(start, index + 1)
      }
    }
  }

  throw new Error('[router] Routing model response contains unterminated JSON object')
}

function parseJsonObject(raw: string): unknown {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = JSON.parse(extractFirstJsonObject(raw))
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('[router] Routing model returned non-object JSON')
  }
  return parsed
}

function parseSelectionFactors(raw: unknown): ModelSelection['factors'] {
  if (!Array.isArray(raw)) {
    return []
  }

  const normalized: ModelSelection['factors'] = []
  for (const factor of raw) {
    if (typeof factor !== 'object' || factor === null || Array.isArray(factor)) continue
    const value = factor as Record<string, unknown>
    const key = typeof value.key === 'string' ? value.key.trim() : ''
    const label = typeof value.label === 'string' ? value.label.trim() : ''
    const content = typeof value.value === 'string' ? value.value.trim() : ''
    if (!key || !label || !content) continue
    normalized.push({ key, label, value: content })
  }
  return normalized
}

function parseModelSelectionResponse(raw: string): ModelSelection {
  const parsedObject = parseJsonObject(raw)
  if (typeof parsedObject !== 'object' || parsedObject === null || Array.isArray(parsedObject)) {
    throw new Error('[router] Routing model returned invalid selection payload')
  }
  const payload = parsedObject as Record<string, unknown>

  const selectedModel =
    typeof payload.selectedModel === 'string' ? payload.selectedModel.trim() : ''
  if (!selectedModel) {
    throw new Error('[router] Routing model response is missing selectedModel')
  }

  const reasoningRaw = typeof payload.reasoning === 'string' ? payload.reasoning.trim() : ''
  const reasoning =
    reasoningRaw.length > 0 ? reasoningRaw : 'Selected the best available model for this request.'

  const categoryParsed = ModelCapabilitySchema.safeParse(payload.category)
  const category = categoryParsed.success ? categoryParsed.data : MODEL_CATEGORIES.GENERAL

  const responseFormatRaw =
    typeof payload.responseFormat === 'string' ? payload.responseFormat.toLowerCase() : ''
  const responseFormat =
    responseFormatRaw === RESPONSE_FORMATS.A2UI ? RESPONSE_FORMATS.A2UI : RESPONSE_FORMATS.MARKDOWN

  const confidenceRaw =
    typeof payload.confidence === 'number' ? payload.confidence : LIMITS.ROUTER_DEFAULT_CONFIDENCE
  const confidence = Math.min(
    LIMITS.ROUTER_CONFIDENCE_MAX,
    Math.max(LIMITS.ROUTER_CONFIDENCE_MIN, confidenceRaw),
  )

  const parsedFactors = parseSelectionFactors(payload.factors)
  const factors =
    parsedFactors.length > 0
      ? parsedFactors
      : [
          {
            key: 'task_type',
            label: 'Task Type',
            value: `Routed as ${category} based on detected request intent.`,
          },
          {
            key: 'tool_need',
            label: 'Tool Capability Fit',
            value: 'Validated compatibility with requested execution requirements.',
          },
          {
            key: 'model_fit',
            label: 'Model Fit',
            value: `Selected model: ${selectedModel}.`,
          },
        ]

  return ModelSelectionSchema.parse({
    category,
    reasoning,
    selectedModel,
    responseFormat,
    confidence,
    factors,
  })
}

function selectRoutingEngineModel(
  registry: ReadonlyArray<ModelConfig>,
  runtimeConfig: RuntimeConfig,
): string {
  const requiredRouterModelId = runtimeConfig.models.autoRouterModel
  const required = registry.find((model) => model.id === requiredRouterModelId)
  if (!required) {
    throw new Error(`[router] Required router model is unavailable: ${requiredRouterModelId}`)
  }
  return required.id
}

function validateModelSelection(
  selection: ModelSelection,
  registry: ReadonlyArray<ModelConfig>,
  webSearchEnabled: boolean,
): ModelSelection {
  const selectedModel = registry.find((model) => model.id === selection.selectedModel)
  if (!selectedModel) {
    throw new Error(`[router] Selected model is unavailable: ${selection.selectedModel}`)
  }

  if (webSearchEnabled && !selectedModel.supportsTools) {
    throw new Error(
      `[router] Selected model does not support tools for web-search-enabled request: ${selection.selectedModel}`,
    )
  }

  if (
    selection.category === MODEL_CATEGORIES.IMAGE_GENERATION &&
    !selectedModel.supportsImageGeneration
  ) {
    throw new Error(
      `[router] Selected model does not support image generation: ${selection.selectedModel}`,
    )
  }

  return selection
}

export async function routeModel(
  prompt: string,
  registry: ReadonlyArray<ModelConfig>,
  runtimeConfig: RuntimeConfig,
  webSearchEnabled: boolean,
  signal?: AbortSignal,
): Promise<ModelSelection> {
  const routingModelId = selectRoutingEngineModel(registry, runtimeConfig)
  const systemPrompt = [
    runtimeConfig.prompts.routerSystem.trim(),
    buildRouterPrompt(registry),
    `Execution context:
- web_search_enabled is ${webSearchEnabled ? 'true' : 'false'}.
- When web_search_enabled is true, selectedModel MUST support tools.
- Set responseFormat="${RESPONSE_FORMATS.A2UI}" only when the user requests generated UI output; otherwise use "${RESPONSE_FORMATS.MARKDOWN}".`,
  ].join('\n\n')

  const wrappedPrompt =
    `${runtimeConfig.prompts.wrappers.userRequestOpen}\n` +
    `${prompt}\n` +
    `${runtimeConfig.prompts.wrappers.userRequestClose}`

  const response = await openrouter.chat.send(
    {
      chatGenerationParams: {
        model: routingModelId,
        messages: [
          { role: MESSAGE_ROLES.SYSTEM, content: systemPrompt },
          { role: MESSAGE_ROLES.USER, content: wrappedPrompt },
        ],
        responseFormat: { type: 'json_object' },
        maxCompletionTokens: runtimeConfig.ai.routerMaxTokens,
        temperature: runtimeConfig.ai.routerTemperature,
      },
    },
    { signal },
  )

  const raw = response.choices[0]?.message.content
  if (typeof raw !== 'string') throw new Error('[router] No content in routing model response')
  const parsed = parseModelSelectionResponse(raw)
  return validateModelSelection(parsed, registry, webSearchEnabled)
}
