'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { VOICE, VOICE_STT_STATES, UI_TEXT } from '@/config/constants'

type SttStatus = (typeof VOICE_STT_STATES)[keyof typeof VOICE_STT_STATES]

type STTState = {
  status: SttStatus
  transcript: string
  interimTranscript: string
  isSupported: boolean
  error: string | null
}

type SpeechRecognitionEvent = {
  resultIndex: number
  results: SpeechRecognitionResultList
}

type SpeechRecognitionErrorEvent = {
  error: string
  message: string
}

type SpeechRecognitionInstance = EventTarget & {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as Record<string, unknown>
  const Ctor = win['SpeechRecognition'] ?? win['webkitSpeechRecognition']
  if (typeof Ctor === 'function') return Ctor as new () => SpeechRecognitionInstance
  return null
}

type UseSpeechToTextOptions = {
  getConstructor?: () => (new () => SpeechRecognitionInstance) | null
}

export function useSpeechToText(options?: UseSpeechToTextOptions) {
  const resolveConstructor = options?.getConstructor ?? getSpeechRecognitionConstructor
  const [state, setState] = useState<STTState>({
    status: VOICE_STT_STATES.IDLE,
    transcript: '',
    interimTranscript: '',
    isSupported: true,
    error: null,
  })
  const [isReady, setIsReady] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const startListening = useCallback(() => {
    const Ctor = resolveConstructor()
    if (!Ctor) return

    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    const recognition = new Ctor()
    recognition.continuous = VOICE.STT_CONTINUOUS
    recognition.interimResults = VOICE.STT_INTERIM_RESULTS
    recognition.lang = VOICE.STT_LANG
    recognitionRef.current = recognition

    recognition.onstart = () => {
      setState((prev) => ({
        ...prev,
        status: VOICE_STT_STATES.LISTENING,
        error: null,
        interimTranscript: '',
      }))
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result?.[0]) continue
        const text = result[0].transcript
        if (result.isFinal) {
          finalTranscript += text
        } else {
          interimTranscript += text
        }
      }

      if (finalTranscript) {
        setState((prev) => ({
          ...prev,
          transcript: (prev.transcript + ' ' + finalTranscript).trim(),
          interimTranscript: '',
        }))
      } else {
        setState((prev) => ({ ...prev, interimTranscript }))
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return

      recognitionRef.current = null
      setState((prev) => ({
        ...prev,
        status: VOICE_STT_STATES.ERROR,
        interimTranscript: '',
        error:
          event.error === 'not-allowed'
            ? UI_TEXT.STT_PERMISSION_DENIED
            : UI_TEXT.STT_TRANSCRIPTION_FAILED,
      }))
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setState((prev) => {
        if (prev.status === VOICE_STT_STATES.ERROR) return prev
        return { ...prev, status: VOICE_STT_STATES.IDLE, interimTranscript: '' }
      })
    }

    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setState((prev) => ({
        ...prev,
        status: VOICE_STT_STATES.ERROR,
        error: UI_TEXT.STT_TRANSCRIPTION_FAILED,
      }))
    }
  }, [resolveConstructor])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setState((prev) => ({ ...prev, status: VOICE_STT_STATES.IDLE, interimTranscript: '' }))
  }, [])

  const resetTranscript = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      error: null,
      status: prev.status === VOICE_STT_STATES.ERROR ? VOICE_STT_STATES.IDLE : prev.status,
    }))
  }, [])

  useEffect(() => {
    setState((prev) => ({ ...prev, isSupported: resolveConstructor() !== null }))
    setIsReady(true)
  }, [resolveConstructor])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  return {
    isListening: state.status === VOICE_STT_STATES.LISTENING,
    transcript: state.transcript,
    interimTranscript: state.interimTranscript,
    isSupported: state.isSupported,
    isReady,
    error: state.error,
    startListening,
    stopListening,
    resetTranscript,
  }
}
