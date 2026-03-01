import { openrouter } from './client'
import type { RuntimeConfig } from '@/schemas/runtime-config'

export async function generateTitle(
  firstMessage: string,
  runtimeConfig: RuntimeConfig,
  signal?: AbortSignal,
): Promise<string> {
  const wrappedMessage =
    `${runtimeConfig.prompts.wrappers.messageOpen}` +
    `${firstMessage}` +
    `${runtimeConfig.prompts.wrappers.messageClose}`

  const response = await openrouter.chat.send(
    {
      chatGenerationParams: {
        model: runtimeConfig.models.routerModel,
        messages: [
          { role: 'system', content: runtimeConfig.prompts.titleSystem },
          {
            role: 'user',
            content: wrappedMessage,
          },
        ],
        maxTokens: runtimeConfig.ai.titleMaxTokens,
        temperature: runtimeConfig.ai.titleTemperature,
      },
    },
    { signal },
  )

  const raw = response.choices[0]?.message.content
  const content = typeof raw === 'string' ? raw.trim() : ''
  if (!content) {
    throw new Error('Title generation returned empty content.')
  }
  return content
}
