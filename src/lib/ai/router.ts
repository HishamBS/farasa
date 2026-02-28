import { openrouter } from './client'
import { ROUTER_MODEL, AI_PARAMS } from '@/config/constants'
import { buildRouterPrompt } from '@/config/prompts'
import { ModelSelectionSchema } from '@/schemas/model'
import type { ModelSelection, ModelConfig } from '@/schemas/model'

export async function routeModel(
  prompt: string,
  registry: ReadonlyArray<ModelConfig>,
): Promise<ModelSelection> {
  const systemPrompt = buildRouterPrompt(registry.map((m) => m.id))
  const response = await openrouter.chat.send({
    chatGenerationParams: {
      model: ROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `<user_request>${prompt}</user_request>` },
      ],
      responseFormat: { type: 'json_object' },
      maxTokens: AI_PARAMS.ROUTER_MAX_TOKENS,
      temperature: AI_PARAMS.ROUTER_TEMPERATURE,
    },
  })

  const raw = response.choices[0]?.message.content
  if (typeof raw !== 'string') throw new Error('[router] No content in routing model response')
  return ModelSelectionSchema.parse(JSON.parse(raw))
}
