import { RESPONSE_FORMATS } from '@/config/constants'
import { buildRouterPrompt } from '@/config/prompts'
import type { ModelConfig, ModelSelection } from '@/schemas/model'
import { ModelSelectionSchema } from '@/schemas/model'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import { z } from 'zod'
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

const ResponseFormatSelectionSchema = z.object({
  responseFormat: z.enum([RESPONSE_FORMATS.MARKDOWN, RESPONSE_FORMATS.A2UI]),
})

export async function decideResponseFormat(
  prompt: string,
  registry: ReadonlyArray<ModelConfig>,
  runtimeConfig: RuntimeConfig,
  signal?: AbortSignal,
): Promise<(typeof RESPONSE_FORMATS)[keyof typeof RESPONSE_FORMATS]> {
  const routingModelId = selectRoutingEngineModel(registry, runtimeConfig)
  const a2uiFormat = RESPONSE_FORMATS.A2UI
  const markdownFormat = RESPONSE_FORMATS.MARKDOWN
  const wrappedPrompt =
    `${runtimeConfig.prompts.wrappers.userRequestOpen}\n` +
    `${prompt}\n` +
    `${runtimeConfig.prompts.wrappers.userRequestClose}`

  const response = await openrouter.chat.send(
    {
      chatGenerationParams: {
        model: routingModelId,
        messages: [
          {
            role: 'system',
            content: `${runtimeConfig.prompts.routerSystem}\n\nYou are selecting output format only.\nReturn JSON: {"responseFormat":"${markdownFormat}"|"${a2uiFormat}"}.\nUse "${a2uiFormat}" for UI-generation requests (forms, components, dashboards, interactive layout output).\nUse "${markdownFormat}" for all other requests.\nReturn only JSON.`,
          },
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
  if (typeof raw !== 'string') {
    return RESPONSE_FORMATS.MARKDOWN
  }

  const parsed = ResponseFormatSelectionSchema.safeParse(parseJsonObject(raw))
  if (!parsed.success) {
    return RESPONSE_FORMATS.MARKDOWN
  }

  return parsed.data.responseFormat
}
