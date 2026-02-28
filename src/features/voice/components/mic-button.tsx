'use client'

import { useCallback, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useSpeechToText } from '../hooks/use-speech-to-text'
import { cn } from '@/lib/utils/cn'

type MicButtonProps = {
  onTranscript: (text: string) => void
}

export function MicButton({ onTranscript }: MicButtonProps) {
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechToText()

  useEffect(() => {
    const combined = transcript + interimTranscript
    if (combined) onTranscript(combined)
  }, [transcript, interimTranscript, onTranscript])

  const handleClick = useCallback(() => {
    if (isListening) {
      stopListening()
      resetTranscript()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening, resetTranscript])

  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg transition-colors',
        isListening
          ? 'text-[--error] hover:bg-[--bg-surface-hover]'
          : 'text-[--text-muted] hover:bg-[--bg-surface-hover] hover:text-[--text-secondary]',
      )}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
      aria-pressed={isListening}
    >
      {isListening ? (
        <span className="relative flex items-center justify-center">
          <MicOff className="size-4" />
          <span className="absolute -bottom-1 flex items-end gap-0.5">
            <span className="h-1 w-0.5 animate-pulse rounded-full bg-[--error]" />
            <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-[--error]" />
            <span className="h-1 w-0.5 animate-pulse rounded-full bg-[--error]" />
          </span>
        </span>
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  )
}
