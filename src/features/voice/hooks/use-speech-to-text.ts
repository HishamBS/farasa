'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { VOICE } from '@/config/constants'

type STTState = {
  isListening: boolean
  isTranscribing: boolean
  transcript: string
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
  onerror: ((event: Event) => void) | null
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

function hasMediaDevices(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

export function useSpeechToText() {
  const [state, setState] = useState<STTState>({
    isListening: false,
    isTranscribing: false,
    transcript: '',
    isSupported: false,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    const supported = hasMediaDevices() || !!getSpeechRecognition()
    setState((prev) => ({ ...prev, isSupported: supported }))
  }, [])

  const transcribeViaServer = useCallback(async (blob: Blob): Promise<string | null> => {
    if (blob.size === 0 || blob.size > VOICE.MAX_AUDIO_BYTES) return null
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: formData })
      if (!res.ok) return null
      const data = (await res.json()) as { transcript?: string }
      return data.transcript ?? null
    } catch {
      return null
    }
  }, [])

  const startListening = useCallback(async () => {
    if (state.isListening || state.isTranscribing) return

    // Primary path: MediaRecorder → server STT
    if (hasMediaDevices()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        chunksRef.current = []
        const recorder = new MediaRecorder(stream)

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop())
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          chunksRef.current = []

          setState((prev) => ({ ...prev, isListening: false, isTranscribing: true }))

          const transcript = await transcribeViaServer(blob)

          if (transcript) {
            setState((prev) => ({ ...prev, transcript, isTranscribing: false }))
            return
          }

          // Fallback: Web Speech API for a quick retry
          setState((prev) => ({ ...prev, isTranscribing: false }))
        }

        mediaRecorderRef.current = recorder
        recorder.start()
        setState((prev) => ({ ...prev, isListening: true }))
        return
      } catch {
        // getUserMedia denied or unavailable — fall through to Web Speech
      }
    }

    // Fallback path: Web Speech API
    const SR = getSpeechRecognition()
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = VOICE.STT_LANG
    recognition.onerror = null

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result?.isFinal) text += result[0]?.transcript ?? ''
      }
      if (text) setState((prev) => ({ ...prev, transcript: text }))
    }

    recognition.onend = () => setState((prev) => ({ ...prev, isListening: false }))

    recognitionRef.current = recognition
    recognition.start()
    setState((prev) => ({ ...prev, isListening: true }))
  }, [state.isListening, state.isTranscribing, transcribeViaServer])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    } else {
      recognitionRef.current?.stop()
      setState((prev) => ({ ...prev, isListening: false }))
    }
  }, [])

  const resetTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: '' }))
  }, [])

  return { ...state, startListening, stopListening, resetTranscript }
}
