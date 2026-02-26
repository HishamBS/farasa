import { openrouter } from './client'
import { ROUTER_MODEL, DEFAULT_MODEL } from '@/config/constants'
import { PROMPTS } from '@/config/prompts'
import { ModelSelectionSchema } from '@/schemas/model'
import type { ModelSelection } from '@/schemas/model'

export async function routeModel(prompt: string): Promise<ModelSelection> {
  try {
    const response = await openrouter.chat.completions.create({
      model: ROUTER_MODEL,
      messages: [
        { role: 'system', content: PROMPTS.ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0,
    })

    const raw = response.choices[0]?.message.content ?? '{}'
    return ModelSelectionSchema.parse(JSON.parse(raw))
  } catch {
    return {
      category: 'general',
      reasoning: 'Fallback to default model due to routing error.',
      selectedModel: DEFAULT_MODEL,
    }
  }
}
