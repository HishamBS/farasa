import { openrouter } from './client'
import { PROMPTS } from '@/config/prompts'
import { LIMITS, ROUTER_MODEL, AI_PARAMS } from '@/config/constants'

export async function generateTitle(firstMessage: string): Promise<string> {
  const response = await openrouter.chat.send({
    chatGenerationParams: {
      model: ROUTER_MODEL,
      messages: [
        { role: 'system', content: PROMPTS.TITLE_GENERATION_PROMPT },
        {
          role: 'user',
          content: `<message>${firstMessage}</message>`,
        },
      ],
      maxTokens: AI_PARAMS.TITLE_MAX_TOKENS,
      temperature: AI_PARAMS.TITLE_TEMPERATURE,
    },
  })

  const raw = response.choices[0]?.message.content
  const content = typeof raw === 'string' ? raw.trim() : ''
  if (!content) {
    throw new Error('Title generation returned empty content.')
  }
  return content.slice(0, LIMITS.CONVERSATION_TITLE_MAX_LENGTH)
}
