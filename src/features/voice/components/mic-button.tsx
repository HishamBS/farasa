'use client'

import { useCallback, useEffect } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { useSpeechToText } from '../hooks/use-speech-to-text'
import { cn } from '@/lib/utils/cn'

type MicButtonProps = {
  onTranscript: (text: string) => void
}

export function MicButton({ onTranscript }: MicButtonProps) {
  const {
    isListening,
    isTranscribing,
    isSupported,
    transcript,
    permissionError,
    transcriptionError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechToText()

  useEffect(() => {
    if (transcript) {
      onTranscript(transcript)
      resetTranscript()
    }
  }, [transcript, onTranscript, resetTranscript])

  const handleClick = useCallback(async () => {
    if (isTranscribing) return
    if (isListening) {
      stopListening()
    } else {
      await startListening()
    }
  }, [isListening, isTranscribing, startListening, stopListening])

  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isTranscribing}
      title={permissionError ?? transcriptionError ?? undefined}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg transition-colors',
        isListening
          ? 'text-(--error) hover:bg-(--bg-surface-hover)'
          : isTranscribing
            ? 'cursor-wait text-(--text-ghost)'
            : permissionError || transcriptionError
              ? 'text-(--error) hover:bg-(--bg-surface-hover)'
              : 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)',
      )}
      aria-label={
        permissionError
          ? permissionError
          : transcriptionError
            ? transcriptionError
            : isListening
              ? 'Stop recording'
              : isTranscribing
                ? 'Transcribing…'
                : 'Start voice input'
      }
      aria-pressed={isListening}
    >
      {isTranscribing ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isListening ? (
        <span className="relative flex items-center justify-center">
          <MicOff className="size-4" />
          <span className="absolute -bottom-1 flex items-end gap-0.5">
            <span className="h-1 w-0.5 animate-pulse rounded-full bg-(--error)" />
            <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-(--error)" />
            <span className="h-1 w-0.5 animate-pulse rounded-full bg-(--error)" />
          </span>
        </span>
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  )
}
