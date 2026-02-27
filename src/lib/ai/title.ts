import { openrouter } from './client'
import { PROMPTS } from '@/config/prompts'
import { LIMITS, ROUTER_MODEL, AI_PARAMS, NEW_CHAT_TITLE } from '@/config/constants'

export async function generateTitle(firstMessage: string): Promise<string> {
  try {
    const response = await openrouter.chat.completions.create({
      model: ROUTER_MODEL,
      messages: [
        { role: 'system', content: PROMPTS.TITLE_GENERATION_PROMPT },
        {
          role: 'user',
          content: `${firstMessage}</message>`,
        },
      ],
      max_tokens: AI_PARAMS.TITLE_MAX_TOKENS,
      temperature: AI_PARAMS.TITLE_TEMPERATURE,
    })

    const raw = response.choices[0]?.message.content?.trim() ?? ''
    return raw.slice(0, LIMITS.CONVERSATION_TITLE_MAX_LENGTH) || NEW_CHAT_TITLE
  } catch {
    return NEW_CHAT_TITLE
  }
}
