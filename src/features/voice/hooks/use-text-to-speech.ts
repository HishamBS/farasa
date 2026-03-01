'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { VOICE } from '@/config/constants'

function speakFallback(text: string, onEnd: () => void): void {
  if (!('speechSynthesis' in window)) {
    onEnd()
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
}

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
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
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsLoading(false)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      stopAudio()
      const trimmed = text.slice(0, VOICE.TTS_MAX_CHARS)
      if (!trimmed) return

      setIsLoading(true)

      try {
        const res = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        })

        if (res.ok) {
          const blob = await res.blob()
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
            speakFallback(trimmed, () => setIsSpeaking(false))
          }

          void audio.play()
          return
        }
      } catch {
        // Server unavailable — fall through to browser TTS
      }

      setIsLoading(false)
      setIsSpeaking(true)
      speakFallback(trimmed, () => setIsSpeaking(false))
    },
    [stopAudio],
  )

  const stop = useCallback(() => {
    stopAudio()
  }, [stopAudio])

  return { speak, stop, isSpeaking, isLoading, isSupported: true }
}
