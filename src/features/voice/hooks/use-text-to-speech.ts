'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { VOICE, UI_TEXT } from '@/config/constants'

function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  )
}

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(() => isSpeechSynthesisSupported())
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const waitForVoices = useCallback(async (): Promise<void> => {
    if (!isSpeechSynthesisSupported()) return
    if (window.speechSynthesis.getVoices().length > 0) return

    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.speechSynthesis.removeEventListener('voiceschanged', finish)
        clearTimeout(timer)
        resolve()
      }
      const timer = window.setTimeout(finish, VOICE.TTS_VOICE_LOAD_TIMEOUT_MS)
      window.speechSynthesis.addEventListener('voiceschanged', finish)
    })
  }, [])

  const selectVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!isSpeechSynthesisSupported()) return null
    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null
    const preferred = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(VOICE.STT_LANG.toLowerCase().split('-')[0] ?? ''),
    )
    return preferred ?? voices[0] ?? null
  }, [])

  useEffect(() => {
    const syncSupport = () => {
      setIsSupported(isSpeechSynthesisSupported())
    }
    syncSupport()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', syncSupport)
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.removeEventListener('voiceschanged', syncSupport)
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      utteranceRef.current = null
    }
  }, [])

  const stopAudio = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
    setIsSpeaking(false)
    setIsLoading(false)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      stopAudio()
      const trimmed = text.slice(0, VOICE.TTS_MAX_CHARS)
      if (!trimmed) return
      if (!isSpeechSynthesisSupported()) {
        setError(UI_TEXT.TTS_UNAVAILABLE)
        return
      }

      setError(null)
      setIsLoading(true)

      try {
        await waitForVoices()
        const utterance = new SpeechSynthesisUtterance(trimmed)
        utterance.lang = VOICE.STT_LANG
        utterance.rate = VOICE.TTS_RATE
        utterance.pitch = VOICE.TTS_PITCH
        const voice = selectVoice()
        if (voice) {
          utterance.voice = voice
          utterance.lang = voice.lang
        }

        utterance.onstart = () => {
          setIsLoading(false)
          setIsSpeaking(true)
        }
        utterance.onend = () => {
          setIsSpeaking(false)
          setIsLoading(false)
          utteranceRef.current = null
        }
        utterance.onerror = () => {
          setIsLoading(false)
          setIsSpeaking(false)
          utteranceRef.current = null
          setError(UI_TEXT.TTS_UNAVAILABLE)
        }

        utteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
      } catch {
        setIsLoading(false)
        setIsSpeaking(false)
        setError(UI_TEXT.TTS_UNAVAILABLE)
      }
    },
    [selectVoice, stopAudio, waitForVoices],
  )

  const stop = useCallback(() => {
    stopAudio()
  }, [stopAudio])

  return { speak, stop, isSpeaking, isLoading, error, isSupported }
}
