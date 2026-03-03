'use client'

import { useCallback, useEffect } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { useSpeechToText } from '../hooks/use-speech-to-text'
import { cn } from '@/lib/utils/cn'
import { UI_TEXT } from '@/config/constants'

type MicButtonProps = {
  onTranscript: (text: string) => void
}

export function MicButton({ onTranscript }: MicButtonProps) {
  const {
    isListening,
    isTranscribing,
    isRequestingPermission,
    isSupported,
    isReady,
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
    if (isTranscribing || isRequestingPermission) return
    if (isListening) {
      stopListening()
    } else {
      await startListening()
    }
  }, [isListening, isRequestingPermission, isTranscribing, startListening, stopListening])

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

  const disabled = isTranscribing || isRequestingPermission
  const title = permissionError ?? transcriptionError ?? undefined

  let ariaLabel: string = UI_TEXT.STT_START
  if (permissionError) ariaLabel = permissionError
  if (transcriptionError) ariaLabel = transcriptionError
  if (isRequestingPermission) ariaLabel = UI_TEXT.STT_REQUESTING_PERMISSION
  if (isTranscribing) ariaLabel = UI_TEXT.STT_TRANSCRIBING
  if (isListening) ariaLabel = UI_TEXT.STT_STOP

  let toneClass = 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)'
  if (isListening) {
    toneClass = 'text-(--error) hover:bg-(--bg-surface-hover)'
  } else if (isTranscribing) {
    toneClass = 'cursor-wait text-(--text-ghost)'
  } else if (isRequestingPermission) {
    toneClass = 'text-(--text-muted) hover:bg-(--bg-surface-hover)'
  } else if (permissionError || transcriptionError) {
    toneClass = 'text-(--error) hover:bg-(--bg-surface-hover)'
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled}
      title={title}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg transition-colors',
        toneClass,
      )}
      aria-label={ariaLabel}
      aria-pressed={isListening}
    >
      {isTranscribing || isRequestingPermission ? (
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
