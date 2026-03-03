'use client'

import { useCallback, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useSpeechToText } from '../hooks/use-speech-to-text'
import { cn } from '@/lib/utils/cn'
import { UI_TEXT } from '@/config/constants'

type MicButtonProps = {
  onTranscript: (text: string) => void
  onInterimTranscript?: (text: string) => void
}

export function MicButton({ onTranscript, onInterimTranscript }: MicButtonProps) {
  const {
    isListening,
    isSupported,
    isReady,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechToText()

  useEffect(() => {
    if (!isListening) return
    const preview = [transcript, interimTranscript].filter(Boolean).join(' ')
    onInterimTranscript?.(preview)
  }, [isListening, transcript, interimTranscript, onInterimTranscript])

  useEffect(() => {
    if (!isListening && transcript) {
      onTranscript(transcript)
      resetTranscript()
    }
  }, [isListening, transcript, onTranscript, resetTranscript])

  const handleClick = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  if (isReady && !isSupported) {
    return (
      <button
        type="button"
        disabled
        title={UI_TEXT.STT_UNSUPPORTED}
        className="flex size-8 cursor-not-allowed items-center justify-center rounded-lg text-(--text-ghost)"
        aria-label={UI_TEXT.STT_UNSUPPORTED}
      >
        <Mic className="size-4" />
      </button>
    )
  }

  const ariaLabel = error ?? (isListening ? UI_TEXT.STT_STOP : UI_TEXT.STT_START)

  const toneClass = isListening
    ? 'text-(--error) hover:bg-(--bg-surface-hover)'
    : error
      ? 'text-(--error) hover:bg-(--bg-surface-hover)'
      : 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={error ?? undefined}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg transition-colors',
        toneClass,
      )}
      aria-label={ariaLabel}
      aria-pressed={isListening}
    >
      {isListening ? (
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
