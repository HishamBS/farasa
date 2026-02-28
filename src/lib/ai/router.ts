import { openrouter } from './client'
import { ROUTER_MODEL, DEFAULT_MODEL, AI_PARAMS, MODEL_CATEGORIES } from '@/config/constants'
import { PROMPTS } from '@/config/prompts'
import { ModelSelectionSchema } from '@/schemas/model'
import type { ModelSelection } from '@/schemas/model'

export async function routeModel(prompt: string): Promise<ModelSelection> {
  const response = await openrouter.chat.send({
    chatGenerationParams: {
      model: ROUTER_MODEL,
      messages: [
        { role: 'system', content: PROMPTS.ROUTER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `<user_request>${prompt}</user_request>`,
        },
      ],
      responseFormat: { type: 'json_object' },
      maxTokens: AI_PARAMS.ROUTER_MAX_TOKENS,
      temperature: AI_PARAMS.ROUTER_TEMPERATURE,
    },
  })

  const raw = response.choices[0]?.message.content
  const content = typeof raw === 'string' ? raw : '{}'
  try {
    return ModelSelectionSchema.parse(JSON.parse(content))
  } catch (error) {
    console.error('[router] Model selection parse failed, using default:', error)
    return {
      selectedModel: DEFAULT_MODEL,
      category: MODEL_CATEGORIES.GENERAL,
      reasoning: 'Auto-router fallback — parse error',
    }
  }
}
