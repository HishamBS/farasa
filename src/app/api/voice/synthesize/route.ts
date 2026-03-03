import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { env } from '@/config/env'
import { VOICE, APP_CONFIG } from '@/config/constants'
import { AppError } from '@/lib/utils/errors'

export const dynamic = 'force-dynamic'

const MARKDOWN_RE = /(\*\*|__|\*|_|~~|`{1,3}|#{1,6}\s|!\[.*?\]\(.*?\)|\[([^\]]+)\]\(.*?\))/g

function stripMarkdown(text: string): string {
  return text.replace(MARKDOWN_RE, '$2').trim()
}

type SSEAudioDelta = {
  choices?: Array<{
    delta?: {
      audio?: {
        data?: string
        transcript?: string
      }
    }
  }>
}

async function collectAudioFromSSE(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  const base64Chunks: string[] = []
  let buffer = ''

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
          base64Chunks.push(audioData)
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  if (base64Chunks.length === 0) {
    throw new Error('No audio data received from model')
  }

  return Buffer.from(base64Chunks.join(''), 'base64')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { errorCode: 'unauthorized', message: AppError.UNAUTHORIZED },
      { status: 401 },
    )
  }

  let text: string
  try {
    const body = (await req.json()) as { text?: unknown }
    if (typeof body.text !== 'string' || body.text.length === 0) {
      return NextResponse.json(
        { errorCode: 'missing_text', message: AppError.TTS_MISSING_TEXT },
        { status: 400 },
      )
    }
    text = stripMarkdown(body.text).slice(0, VOICE.TTS_MAX_CHARS)
  } catch {
    return NextResponse.json(
      { errorCode: 'invalid_body', message: AppError.TTS_INVALID_BODY },
      { status: 400 },
    )
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
            role: 'user',
            content: `Read the following text aloud exactly as written, without adding any commentary:\n\n${text}`,
          },
        ],
        modalities: ['text', 'audio'],
        audio: {
          voice: VOICE.TTS_VOICE,
          format: VOICE.TTS_FORMAT,
        },
        stream: true,
      }),
    })

    if (!response.ok) {
      const providerError = await response.text()
      console.error('[TTS] OpenRouter error:', response.status, providerError)
      return NextResponse.json(
        {
          errorCode: 'provider_error',
          message: `${AppError.TTS_PROVIDER_FAILED} (${response.status}).`,
        },
        { status: 502 },
      )
    }

    const audioBuffer = await collectAudioFromSSE(response)

    const contentType =
      VOICE.TTS_FORMAT === 'mp3'
        ? 'audio/mpeg'
        : VOICE.TTS_FORMAT === 'wav'
          ? 'audio/wav'
          : VOICE.TTS_FORMAT === 'opus'
            ? 'audio/opus'
            : VOICE.TTS_FORMAT === 'flac'
              ? 'audio/flac'
              : 'audio/mpeg'

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': contentType,
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
      { status: 500 },
    )
  }
}
