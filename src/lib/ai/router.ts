import { openrouter } from './client'
import { ModelSelectionSchema } from '@/schemas/model'
import { buildRouterPrompt } from '@/config/prompts'
import type { ModelSelection, ModelConfig } from '@/schemas/model'
import type { RuntimeConfig } from '@/schemas/runtime-config'

export async function routeModel(
  prompt: string,
  registry: ReadonlyArray<ModelConfig>,
  runtimeConfig: RuntimeConfig,
  signal?: AbortSignal,
): Promise<ModelSelection> {
  const systemPrompt = buildRouterPrompt(registry)

  const wrappedPrompt =
    `${runtimeConfig.prompts.wrappers.userRequestOpen}\n` +
    `${prompt}\n` +
    `${runtimeConfig.prompts.wrappers.userRequestClose}`

  const response = await openrouter.chat.send(
    {
      chatGenerationParams: {
        model: runtimeConfig.models.routerModel,
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
  return ModelSelectionSchema.parse(JSON.parse(raw))
}
