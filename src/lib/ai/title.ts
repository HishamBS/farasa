import { openrouter } from './client'
import { PROMPTS } from '@/config/prompts'
import { LIMITS, ROUTER_MODEL } from '@/config/constants'

export async function generateTitle(firstMessage: string): Promise<string> {
  try {
    const response = await openrouter.chat.completions.create({
      model: ROUTER_MODEL,
      messages: [
        { role: 'system', content: PROMPTS.TITLE_GENERATION_PROMPT },
        { role: 'user', content: firstMessage },
      ],
      max_tokens: 50,
      temperature: 0.3,
    })

    const raw = response.choices[0]?.message.content?.trim() ?? ''
    return raw.slice(0, LIMITS.CONVERSATION_TITLE_MAX_LENGTH) || 'New Chat'
  } catch {
    return 'New Chat'
  }
}
