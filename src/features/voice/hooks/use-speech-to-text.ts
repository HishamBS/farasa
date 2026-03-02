'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { VOICE, UI_TEXT } from '@/config/constants'

type STTState = {
  isListening: boolean
  isTranscribing: boolean
  isRequestingPermission: boolean
  transcript: string
  isSupported: boolean
  permissionError: string | null
  transcriptionError: string | null
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
    isRequestingPermission: false,
    transcript: '',
    isSupported: false,
    permissionError: null,
    transcriptionError: null,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    setState((prev) => ({ ...prev, isSupported: hasMediaDevices() }))
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

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
  }, [])

  const startListening = useCallback(async () => {
    if (
      state.isListening ||
      state.isTranscribing ||
      state.isRequestingPermission ||
      !hasMediaDevices()
    ) {
      return
    }

    setState((prev) => ({
      ...prev,
      permissionError: null,
      transcriptionError: null,
      isRequestingPermission: true,
    }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.onstart = () => {
        setState((prev) => ({
          ...prev,
          isListening: true,
          isRequestingPermission: false,
          permissionError: null,
        }))
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        cleanupStream()
        setState((prev) => ({
          ...prev,
          isListening: false,
          isRequestingPermission: false,
          transcriptionError: UI_TEXT.STT_TRANSCRIPTION_FAILED,
        }))
      }

      recorder.onstop = async () => {
        cleanupStream()
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []

        setState((prev) => ({
          ...prev,
          isListening: false,
          isTranscribing: true,
          isRequestingPermission: false,
          transcriptionError: null,
        }))

        const transcript = await transcribeViaServer(blob)

        if (transcript) {
          setState((prev) => ({
            ...prev,
            transcript,
            isTranscribing: false,
            transcriptionError: null,
          }))
          return
        }

        setState((prev) => ({
          ...prev,
          isTranscribing: false,
          transcriptionError: UI_TEXT.STT_TRANSCRIPTION_FAILED,
        }))
      }

      recorder.start()
    } catch (error) {
      cleanupStream()
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setState((prev) => ({
          ...prev,
          isRequestingPermission: false,
          permissionError: UI_TEXT.STT_PERMISSION_DENIED,
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        isRequestingPermission: false,
        transcriptionError: UI_TEXT.STT_TRANSCRIPTION_FAILED,
      }))
    }
  }, [
    cleanupStream,
    state.isListening,
    state.isRequestingPermission,
    state.isTranscribing,
    transcribeViaServer,
  ])

  const stopListening = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setState((prev) => ({
        ...prev,
        isListening: false,
      }))
      return
    }
    recorder.stop()
  }, [])

  const resetTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: '' }))
  }, [])

  useEffect(() => {
    return () => {
      cleanupStream()
    }
  }, [cleanupStream])

  return { ...state, startListening, stopListening, resetTranscript }
}
