import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { env } from '@/config/env'
import { VOICE, APP_CONFIG, EXTERNAL_URLS } from '@/config/constants'
import { AppError } from '@/lib/utils/errors'
import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'

const MARKDOWN_RE = /(\*\*|__|\*|_|~~|`{1,3}|#{1,6}\s|!\[.*?\]\(.*?\)|\[([^\]]+)\]\(.*?\))/g

function stripMarkdown(text: string): string {
  return text.replace(MARKDOWN_RE, '$2').trim()
}

type AudioCompletionResponse = {
  choices?: Array<{
    message?: {
      audio?: {
        data?: string
        transcript?: string
      }
    }
  }>
}

const AUDIO_CONTENT_TYPE: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/opus',
  flac: 'audio/flac',
} as const

const handler = auth(async function POST(req) {
  if (!req.auth?.user) {
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
            role: 'user',
            content: `Read the following text aloud exactly as written, without adding any commentary:\n\n<message>${escapeXmlForPrompt(text)}</message>`,
          },
        ],
        modalities: ['text', 'audio'],
        audio: {
          voice: VOICE.TTS_VOICE,
          format: VOICE.TTS_FORMAT,
        },
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

    const result = (await response.json()) as AudioCompletionResponse
    const audioData = result.choices?.[0]?.message?.audio?.data
    if (typeof audioData !== 'string' || audioData.length === 0) {
      throw new Error('No audio data in response')
    }

    const audioBuffer = Buffer.from(audioData, 'base64')
    const contentType = AUDIO_CONTENT_TYPE[VOICE.TTS_FORMAT] ?? 'audio/mpeg'

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
})

export async function POST(req: NextRequest) {
  return handler(req, {})
}
