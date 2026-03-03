import { buildRouterPrompt } from '@/config/prompts'
import type { ModelConfig, ModelSelection } from '@/schemas/model'
import { ModelSelectionSchema } from '@/schemas/model'
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
  const systemPrompt = `${buildRouterPrompt(registry)}

Execution policy:
- web_search_enabled is ${webSearchEnabled ? 'true' : 'false'}.
- If web_search_enabled is true, selectedModel MUST support tools.
- If web_search_enabled is false, do not optimize for tool capability unless otherwise needed by prompt semantics.
- Prefer higher-capability and higher-context models for non-trivial requests when they exist in the candidate list.`

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
        maxCompletionTokens: runtimeConfig.ai.routerMaxTokens,
        temperature: runtimeConfig.ai.routerTemperature,
      },
    },
    { signal },
  )

  const raw = response.choices[0]?.message.content
  if (typeof raw !== 'string') throw new Error('[router] No content in routing model response')
  const parsed = ModelSelectionSchema.parse(parseJsonObject(raw))
  return validateModelSelection(parsed, registry, webSearchEnabled)
}
