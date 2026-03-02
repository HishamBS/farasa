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
  const startRequestSeqRef = useRef(0)

  useEffect(() => {
    setState((prev) => ({ ...prev, isSupported: hasMediaDevices() }))
  }, [])

  const transcribeViaServer = useCallback(async (blob: Blob): Promise<string | null> => {
    if (blob.size === 0 || blob.size > VOICE.MAX_AUDIO_BYTES) return null

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(VOICE.STT_TRANSCRIBE_TIMEOUT_MS),
      })
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

  const setIdle = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isListening: false,
      isRequestingPermission: false,
    }))
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
    const requestSeq = startRequestSeqRef.current + 1
    startRequestSeqRef.current = requestSeq

    setState((prev) => ({
      ...prev,
      permissionError: null,
      transcriptionError: null,
      isRequestingPermission: true,
    }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (requestSeq !== startRequestSeqRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.onstart = () => {
        if (requestSeq !== startRequestSeqRef.current) return
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
        if (requestSeq !== startRequestSeqRef.current) return
        cleanupStream()
        setState((prev) => ({
          ...prev,
          isListening: false,
          isRequestingPermission: false,
          transcriptionError: UI_TEXT.STT_TRANSCRIPTION_FAILED,
        }))
      }

      recorder.onstop = async () => {
        if (requestSeq !== startRequestSeqRef.current) return
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
        if (requestSeq !== startRequestSeqRef.current) return

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
      setState((prev) => ({
        ...prev,
        isListening: true,
        isRequestingPermission: false,
        permissionError: null,
        transcriptionError: null,
      }))
    } catch (error) {
      if (requestSeq !== startRequestSeqRef.current) return
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
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    startRequestSeqRef.current += 1
    if (!recorder || recorder.state === 'inactive') {
      cleanupStream()
      setIdle()
      return
    }
  }, [cleanupStream, setIdle])

  const resetTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: '' }))
  }, [])

  useEffect(() => {
    return () => {
      startRequestSeqRef.current += 1
      cleanupStream()
    }
  }, [cleanupStream])

  return { ...state, startListening, stopListening, resetTranscript }
}
