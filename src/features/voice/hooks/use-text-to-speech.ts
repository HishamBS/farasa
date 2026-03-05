'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { VOICE, VOICE_TTS_STATES, UI_TEXT } from '@/config/constants'

type TtsStatus = (typeof VOICE_TTS_STATES)[keyof typeof VOICE_TTS_STATES]

type TtsState = {
  status: TtsStatus
  error: string | null
}

type TtsErrorResponse = {
  message?: string
}

function isAudioElementSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Audio === 'function'
}

export function useTextToSpeech() {
  const [state, setState] = useState<TtsState>({
    status: VOICE_TTS_STATES.IDLE,
    error: null,
  })
  const [isReady, setIsReady] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    cleanupAudio()
    setState((prev) => {
      if (prev.status === VOICE_TTS_STATES.UNAVAILABLE) return prev
      return { ...prev, status: VOICE_TTS_STATES.IDLE }
    })
  }, [cleanupAudio])

  const speak = useCallback(
    async (text: string) => {
      stop()

      if (!isAudioElementSupported()) {
        setState({
          status: VOICE_TTS_STATES.UNAVAILABLE,
          error: UI_TEXT.TTS_UNAVAILABLE,
        })
        return
      }

      const trimmed = text.slice(0, VOICE.TTS_MAX_CHARS).trim()
      if (!trimmed) return

      const controller = new AbortController()
      abortControllerRef.current = controller
      setState({ status: VOICE_TTS_STATES.LOADING, error: null })

      try {
        const response = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
          signal: controller.signal,
        })

        if (!response.ok) {
          let errorMessage: string = UI_TEXT.TTS_UNAVAILABLE
          try {
            const payload = (await response.json()) as TtsErrorResponse
            if (typeof payload.message === 'string' && payload.message.length > 0) {
              errorMessage = payload.message
            }
          } catch {
            // ignore malformed error payloads
          }
          setState({
            status: VOICE_TTS_STATES.ERROR,
            error: errorMessage,
          })
          return
        }

        const audioBlob = await response.blob()
        if (controller.signal.aborted) return

        const objectUrl = URL.createObjectURL(audioBlob)
        objectUrlRef.current = objectUrl
        const audio = new Audio(objectUrl)
        audioRef.current = audio

        audio.onended = () => {
          cleanupAudio()
          setState({ status: VOICE_TTS_STATES.IDLE, error: null })
        }

        audio.onerror = () => {
          cleanupAudio()
          setState({ status: VOICE_TTS_STATES.ERROR, error: UI_TEXT.TTS_UNAVAILABLE })
        }

        await audio.play()
        setState({ status: VOICE_TTS_STATES.SPEAKING, error: null })
      } catch {
        if (controller.signal.aborted) return
        setState({
          status: VOICE_TTS_STATES.ERROR,
          error: UI_TEXT.TTS_UNAVAILABLE,
        })
      }
    },
    [cleanupAudio, stop],
  )

  useEffect(() => {
    if (!isAudioElementSupported()) {
      setState({ status: VOICE_TTS_STATES.UNAVAILABLE, error: UI_TEXT.TTS_UNAVAILABLE })
    }
    setIsReady(true)
  }, [])

  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    speak,
    stop,
    status: state.status,
    error: state.error,
    isReady,
  }
}
