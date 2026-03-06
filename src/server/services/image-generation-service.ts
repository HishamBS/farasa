import { LIMITS } from '@/config/constants'
import type { ModelConfig } from '@/schemas/model'
import { UsageSchema } from '@/schemas/message'
import type { Usage } from '@/schemas/message'
import type { Message } from '@openrouter/sdk/models'
import { z } from 'zod'

const ImageUrlObjectSchema = z.object({
  url: z.string(),
})

const ImageContentItemSchema = z.object({
  type: z.string(),
  image_url: ImageUrlObjectSchema.optional(),
  text: z.string().optional(),
})

const ImageMessageSchema = z.object({
  content: z
    .union([z.string(), z.array(ImageContentItemSchema)])
    .optional()
    .nullable(),
  images: z
    .array(
      z.object({
        imageUrl: z.object({ url: z.string() }),
      }),
    )
    .optional(),
})

type ImageGenerationResult = {
  imageContent: string
  usage: Usage | undefined
}

function parseImageResponse(rawMessage: unknown): string {
  const parsed = ImageMessageSchema.safeParse(rawMessage)
  if (!parsed.success) {
    console.error('[image-gen] Response validation failed:', parsed.error.message)
    return ''
  }

  const { content, images } = parsed.data

  if (typeof content === 'string' && content.length > 0) {
    return content
  }

  if (images && images.length > 0) {
    const parts: string[] = []
    for (const img of images) {
      if (img.imageUrl.url) {
        parts.push(`![Generated Image](${img.imageUrl.url})`)
      }
    }
    if (parts.length > 0) return parts.join('\n\n')
  }

  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const item of content) {
      if (item.text) {
        parts.push(item.text)
      }
      if (item.image_url?.url) {
        parts.push(`![Generated Image](${item.image_url.url})`)
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

  console.log('[image-gen] Calling model:', params.model, 'timeout:', LIMITS.IMAGE_GEN_TIMEOUT_MS)

  let response
  try {
    response = await openrouter.chat.send(
      {
        chatGenerationParams: {
          model: params.model,
          messages: params.messages,
          stream: false,
          modalities: ['image'],
        },
      },
      { signal: imageSignal },
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[image-gen] API call failed:', msg)
    throw error
  }

  console.log('[image-gen] Response received, choices:', response.choices?.length)
  const rawMessage = response.choices[0]?.message
  if (!rawMessage) {
    console.error('[image-gen] No message in response choices')
  } else {
    console.log('[image-gen] Response message keys:', Object.keys(rawMessage))
  }
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
