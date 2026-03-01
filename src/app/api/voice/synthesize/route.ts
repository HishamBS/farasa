import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { env } from '@/config/env'
import { VOICE, APP_CONFIG } from '@/config/constants'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let text: string
  try {
    const body = (await req.json()) as { text?: unknown }
    if (typeof body.text !== 'string' || body.text.length === 0) {
      return NextResponse.json({ error: 'Missing text field' }, { status: 400 })
    }
    text = body.text.slice(0, VOICE.TTS_MAX_CHARS)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
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
      console.error('[TTS] OpenRouter error:', response.status, await response.text())
      return NextResponse.json({ error: 'unavailable' }, { status: 502 })
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
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }
}
