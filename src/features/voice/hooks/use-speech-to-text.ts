'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type STTState = {
  isListening: boolean
  transcript: string
  interimTranscript: string
  isSupported: boolean
}

// Web Speech API type augmentation — not in all TypeScript lib versions
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

export function useSpeechToText() {
  const [state, setState] = useState<STTState>({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    isSupported: false,
  })
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    if (getSpeechRecognition()) setState((prev) => ({ ...prev, isSupported: true }))
  }, [])

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result?.isFinal) {
          final += result[0]?.transcript ?? ''
        } else {
          interim += result?.[0]?.transcript ?? ''
        }
      }
      setState((prev) => ({
        ...prev,
        transcript: prev.transcript + final,
        interimTranscript: interim,
      }))
    }

    recognition.onend = () =>
      setState((prev) => ({ ...prev, isListening: false, interimTranscript: '' }))

    recognitionRef.current = recognition
    recognition.start()
    setState((prev) => ({ ...prev, isListening: true }))
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setState((prev) => ({ ...prev, isListening: false }))
  }, [])

  const resetTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: '', interimTranscript: '' }))
  }, [])

  return { ...state, startListening, stopListening, resetTranscript }
}
