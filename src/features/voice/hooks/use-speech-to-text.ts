'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { VOICE, VOICE_STT_STATES, UI_TEXT } from '@/config/constants'

type SttStatus = (typeof VOICE_STT_STATES)[keyof typeof VOICE_STT_STATES]

type STTState = {
  status: SttStatus
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
    status: VOICE_STT_STATES.IDLE,
    transcript: '',
    isSupported: true,
    permissionError: null,
    transcriptionError: null,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const requestSeqRef = useRef(0)

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
  }, [])

  const transcribeViaServer = useCallback(async (blob: Blob): Promise<string | null> => {
    if (blob.size === 0 || blob.size > VOICE.MAX_AUDIO_BYTES) return null

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(VOICE.STT_TRANSCRIBE_TIMEOUT_MS),
      })
      if (!response.ok) return null
      const data = (await response.json()) as { transcript?: string }
      return data.transcript ?? null
    } catch {
      return null
    }
  }, [])

  const startListening = useCallback(async () => {
    if (!hasMediaDevices()) return
    if (state.status === VOICE_STT_STATES.REQUESTING_PERMISSION) return
    if (state.status === VOICE_STT_STATES.LISTENING) return
    if (state.status === VOICE_STT_STATES.TRANSCRIBING) return

    const requestSeq = requestSeqRef.current + 1
    requestSeqRef.current = requestSeq

    setState((prev) => ({
      ...prev,
      status: VOICE_STT_STATES.REQUESTING_PERMISSION,
      permissionError: null,
      transcriptionError: null,
    }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (requestSeq !== requestSeqRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.onstart = () => {
        if (requestSeq !== requestSeqRef.current) return
        setState((prev) => ({
          ...prev,
          status: VOICE_STT_STATES.LISTENING,
          permissionError: null,
          transcriptionError: null,
        }))
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        if (requestSeq !== requestSeqRef.current) return
        cleanupStream()
        setState((prev) => ({
          ...prev,
          status: VOICE_STT_STATES.ERROR,
          transcriptionError: UI_TEXT.STT_TRANSCRIPTION_FAILED,
        }))
      }

      recorder.onstop = async () => {
        if (requestSeq !== requestSeqRef.current) return

        cleanupStream()
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []

        setState((prev) => ({
          ...prev,
          status: VOICE_STT_STATES.TRANSCRIBING,
          transcriptionError: null,
        }))

        const transcript = await transcribeViaServer(blob)
        if (requestSeq !== requestSeqRef.current) return

        if (transcript) {
          setState((prev) => ({
            ...prev,
            status: VOICE_STT_STATES.IDLE,
            transcript,
            transcriptionError: null,
          }))
          return
        }

        setState((prev) => ({
          ...prev,
          status: VOICE_STT_STATES.ERROR,
          transcriptionError: UI_TEXT.STT_TRANSCRIPTION_FAILED,
        }))
      }

      recorder.start()
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) return
      cleanupStream()
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setState((prev) => ({
          ...prev,
          status: VOICE_STT_STATES.ERROR,
          permissionError: UI_TEXT.STT_PERMISSION_DENIED,
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        status: VOICE_STT_STATES.ERROR,
        transcriptionError: UI_TEXT.STT_TRANSCRIPTION_FAILED,
      }))
    }
  }, [cleanupStream, state.status, transcribeViaServer])

  const stopListening = useCallback(() => {
    const recorder = mediaRecorderRef.current

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }

    requestSeqRef.current += 1
    cleanupStream()
    setState((prev) => ({
      ...prev,
      status: VOICE_STT_STATES.IDLE,
    }))
  }, [cleanupStream])

  const resetTranscript = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transcript: '',
      status: prev.status === VOICE_STT_STATES.ERROR ? VOICE_STT_STATES.IDLE : prev.status,
    }))
  }, [])

  useEffect(() => {
    setState((prev) => ({ ...prev, isSupported: hasMediaDevices() }))
  }, [])

  useEffect(() => {
    return () => {
      requestSeqRef.current += 1
      cleanupStream()
    }
  }, [cleanupStream])

  const isListening = state.status === VOICE_STT_STATES.LISTENING
  const isTranscribing = state.status === VOICE_STT_STATES.TRANSCRIBING
  const isRequestingPermission = state.status === VOICE_STT_STATES.REQUESTING_PERMISSION

  return {
    isListening,
    isTranscribing,
    isRequestingPermission,
    transcript: state.transcript,
    isSupported: state.isSupported,
    permissionError: state.permissionError,
    transcriptionError: state.transcriptionError,
    startListening,
    stopListening,
    resetTranscript,
  }
}
