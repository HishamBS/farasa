import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { env } from '@/config/env'
import { VOICE, APP_CONFIG } from '@/config/constants'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const audioFile = formData.get('audio')
  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: 'Missing audio field' }, { status: 400 })
  }

  if (audioFile.size > VOICE.MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio file too large' }, { status: 413 })
  }

  try {
    const orFormData = new FormData()
    orFormData.append('model', VOICE.STT_MODEL)
    orFormData.append('file', audioFile, 'audio.webm')
    orFormData.append('language', VOICE.STT_LANG.split('-')[0] ?? 'en')

    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
        'X-Title': APP_CONFIG.NAME,
      },
      body: orFormData,
    })

    if (!response.ok) {
      console.error('[STT] OpenRouter error:', response.status, await response.text())
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
    }

    const data = (await response.json()) as { text?: string }
    return NextResponse.json({ transcript: data.text ?? '' })
  } catch (error) {
    console.error('[STT] Error:', error)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
