import { LIMITS } from '@/config/constants'
import type { ModelConfig } from '@/schemas/model'
import { UsageSchema } from '@/schemas/message'
import type { Usage } from '@/schemas/message'
import { getModelMaxCompletionTokens } from '@/lib/ai/registry'
import type { Message } from '@openrouter/sdk/models'

type ImageGenerationResult = {
  imageContent: string
  usage: Usage | undefined
}

export function parseImageResponse(rawMessage: Record<string, unknown> | undefined): string {
  const messageContent = rawMessage?.content
  const messageImages = rawMessage?.images

  if (typeof messageContent === 'string' && messageContent.length > 0) {
    return messageContent
  }

  if (Array.isArray(messageImages)) {
    const parts: string[] = []
    for (const img of messageImages as Array<Record<string, unknown>>) {
      const nested = img?.imageUrl as Record<string, unknown> | undefined
      if (typeof nested?.url === 'string') {
        parts.push(`![Generated Image](${nested.url})`)
      } else if (typeof img?.url === 'string') {
        parts.push(`![Generated Image](${img.url})`)
      } else if (typeof img?.b64_json === 'string') {
        parts.push(`![Generated Image](data:image/png;base64,${img.b64_json})`)
      }
    }
    if (parts.length > 0) return parts.join('\n\n')
  }

  if (Array.isArray(messageContent)) {
    const parts: string[] = []
    for (const item of messageContent as Array<Record<string, unknown>>) {
      if (typeof item?.text === 'string') {
        parts.push(item.text)
      }
      const imageUrl = item?.image_url as Record<string, unknown> | undefined
      if (typeof imageUrl?.url === 'string') {
        parts.push(`![Generated Image](${imageUrl.url})`)
      }
    }
    if (parts.length > 0) return parts.join('\n\n')
  }

  return ''
}

export async function executeImageGeneration(params: {
  model: string
  messages: Message[]
  signal: AbortSignal
  registry: ReadonlyArray<ModelConfig>
}): Promise<ImageGenerationResult> {
  const { openrouter } = await import('@/lib/ai/client')
  const imageSignal = AbortSignal.any([
    params.signal,
    AbortSignal.timeout(LIMITS.IMAGE_GEN_TIMEOUT_MS),
  ])

  const response = await openrouter.chat.send(
    {
      chatGenerationParams: {
        model: params.model,
        messages: params.messages,
        stream: false,
        maxCompletionTokens: getModelMaxCompletionTokens(params.registry, params.model),
      },
    },
    { signal: imageSignal },
  )

  const rawMessage = response.choices[0]?.message as Record<string, unknown> | undefined
  const imageContent = parseImageResponse(rawMessage)

  let usage: Usage | undefined
  if (response.usage) {
    const parsedUsage = UsageSchema.safeParse({
      promptTokens: response.usage.promptTokens ?? 0,
      completionTokens: response.usage.completionTokens ?? 0,
      totalTokens: response.usage.totalTokens ?? 0,
    })
    if (parsedUsage.success) {
      usage = parsedUsage.data
    }
  }

  return { imageContent, usage }
}
