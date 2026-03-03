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
    const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
        'X-Title': APP_CONFIG.NAME,
      },
      body: JSON.stringify({ model: VOICE.TTS_MODEL, input: text }),
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

    const audioBuffer = await response.arrayBuffer()
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
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
