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
        'flex size-8 items-center justify-center rounded-xl transition-colors',
        isListening
          ? 'text-[--error] hover:bg-[--bg-surface-hover]'
          : 'text-[--text-ghost] hover:text-[--text-secondary]',
      )}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
      aria-pressed={isListening}
    >
      {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
    </button>
  )
}
