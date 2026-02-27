import { openrouter } from './client'
import { ROUTER_MODEL, DEFAULT_MODEL, MODEL_CATEGORIES, AI_PARAMS, AI_REASONING } from '@/config/constants'
import { PROMPTS } from '@/config/prompts'
import { ModelSelectionSchema } from '@/schemas/model'
import type { ModelSelection } from '@/schemas/model'

export async function routeModel(prompt: string): Promise<ModelSelection> {
  try {
    const response = await openrouter.chat.completions.create({
      model: ROUTER_MODEL,
      messages: [
        { role: 'system', content: PROMPTS.ROUTER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `<user_request>${prompt}</user_request>`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: AI_PARAMS.ROUTER_MAX_TOKENS,
      temperature: AI_PARAMS.ROUTER_TEMPERATURE,
    })

    const raw = response.choices[0]?.message.content ?? '{}'
    return ModelSelectionSchema.parse(JSON.parse(raw))
  } catch {
    return {
      category: MODEL_CATEGORIES.GENERAL,
      reasoning: AI_REASONING.ROUTING_FALLBACK,
      selectedModel: DEFAULT_MODEL,
    }
  }
}
