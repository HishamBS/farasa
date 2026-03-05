export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { env } from '@/config/env'
import {
  HTTP_STATUS,
  MESSAGE_ROLES,
  VOICE,
  APP_CONFIG,
  EXTERNAL_URLS,
  LIMITS,
} from '@/config/constants'
import { PROMPTS } from '@/config/prompts'
import { AppError } from '@/lib/utils/errors'
import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'

const MARKDOWN_RE = /(\*\*|__|\*|_|~~|`{1,3}|#{1,6}\s|!\[.*?\]\(.*?\)|\[([^\]]+)\]\(.*?\))/g

function stripMarkdown(text: string): string {
  return text.replace(MARKDOWN_RE, '$2').trim()
}

type SSEAudioDelta = {
  choices?: Array<{
    delta?: {
      audio?: {
        data?: string
      }
    }
  }>
}

/** Build a 44-byte RIFF/WAV header for raw PCM16 mono audio. */
function createWavHeader(pcmByteLength: number, sampleRate: number): Buffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcmByteLength, 4)
  header.write('WAVE', 8)

  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // subchunk1 size (PCM)
  header.writeUInt16LE(1, 20) // audio format (1 = PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  header.write('data', 36)
  header.writeUInt32LE(pcmByteLength, 40)

  return header
}

async function collectAudioFromSSE(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  const pcmChunks: Buffer[] = []
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') continue

        try {
          const parsed = JSON.parse(payload) as SSEAudioDelta
          const audioData = parsed.choices?.[0]?.delta?.audio?.data
          if (typeof audioData === 'string' && audioData.length > 0) {
            pcmChunks.push(Buffer.from(audioData, 'base64'))
          }
        } catch {
          // Skip malformed SSE payloads
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (pcmChunks.length === 0) {
    throw new Error('No audio data received from model')
  }

  const pcmBuffer = Buffer.concat(pcmChunks)
  const wavHeader = createWavHeader(pcmBuffer.byteLength, VOICE.TTS_SAMPLE_RATE)
  return Buffer.concat([wavHeader, pcmBuffer])
}

const handler = auth(async function POST(req) {
  if (!req.auth?.user) {
    return NextResponse.json(
      { errorCode: 'unauthorized', message: AppError.UNAUTHORIZED },
      { status: HTTP_STATUS.UNAUTHORIZED },
    )
  }

  let text: string
  try {
    const body = (await req.json()) as { text?: unknown }
    if (typeof body.text !== 'string' || body.text.length === 0) {
      return NextResponse.json(
        { errorCode: 'missing_text', message: AppError.TTS_MISSING_TEXT },
        { status: HTTP_STATUS.BAD_REQUEST },
      )
    }
    text = stripMarkdown(body.text).slice(0, VOICE.TTS_MAX_CHARS)
  } catch {
    return NextResponse.json(
      { errorCode: 'invalid_body', message: AppError.TTS_INVALID_BODY },
      { status: HTTP_STATUS.BAD_REQUEST },
    )
  }

  try {
    const response = await fetch(EXTERNAL_URLS.OPENROUTER_CHAT_COMPLETIONS, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
        'X-Title': APP_CONFIG.NAME,
      },
      body: JSON.stringify({
        model: VOICE.TTS_MODEL,
        messages: [
          {
            role: MESSAGE_ROLES.USER,
            content: `${PROMPTS.TTS_READ_ALOUD}\n\n<message>${escapeXmlForPrompt(text)}</message>`,
          },
        ],
        modalities: ['text', 'audio'],
        audio: {
          voice: VOICE.TTS_VOICE,
          format: VOICE.TTS_FORMAT,
        },
        stream: true,
      }),
      signal: AbortSignal.timeout(LIMITS.STREAM_TIMEOUT_MS),
    })

    if (!response.ok) {
      const providerError = await response.text()
      console.error('[TTS] OpenRouter error:', response.status, providerError)
      return NextResponse.json(
        {
          errorCode: 'provider_error',
          message: `${AppError.TTS_PROVIDER_FAILED} (${response.status}).`,
        },
        { status: HTTP_STATUS.BAD_GATEWAY },
      )
    }

    const wavBuffer = await collectAudioFromSSE(response)

    return new NextResponse(new Uint8Array(wavBuffer), {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[TTS] Error:', error)
    return NextResponse.json(
      {
        errorCode: 'runtime_error',
        message: AppError.TTS_RUNTIME_FAILED,
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    )
  }
})

export async function POST(req: NextRequest) {
  return handler(req, {})
}
