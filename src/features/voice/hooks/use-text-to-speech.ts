'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { VOICE, UI_TEXT } from '@/config/constants'

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setIsSpeaking(false)
    setIsLoading(false)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      stopAudio()
      const trimmed = text.slice(0, VOICE.TTS_MAX_CHARS)
      if (!trimmed) return

      setError(null)
      setIsLoading(true)

      try {
        const response = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        })

        if (!response.ok) {
          setIsLoading(false)
          setIsSpeaking(false)
          setError(UI_TEXT.TTS_UNAVAILABLE)
          return
        }

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio

        audio.oncanplaythrough = () => {
          setIsLoading(false)
          setIsSpeaking(true)
        }
        audio.onended = () => {
          URL.revokeObjectURL(url)
          setIsSpeaking(false)
          audioRef.current = null
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          setIsLoading(false)
          setIsSpeaking(false)
          audioRef.current = null
          setError(UI_TEXT.TTS_UNAVAILABLE)
        }

        await audio.play()
      } catch {
        setIsLoading(false)
        setIsSpeaking(false)
        setError(UI_TEXT.TTS_UNAVAILABLE)
      }
    },
    [stopAudio],
  )

  const stop = useCallback(() => {
    stopAudio()
  }, [stopAudio])

  return { speak, stop, isSpeaking, isLoading, error, isSupported: true }
}
