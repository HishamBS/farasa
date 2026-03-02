'use client'

import { useCallback } from 'react'
import { Volume2, VolumeX, Loader2 } from 'lucide-react'
import { useTextToSpeech } from '../hooks/use-text-to-speech'
import { cn } from '@/lib/utils/cn'
import { UI_TEXT } from '@/config/constants'

type TTSControlsProps = {
  content: string
}

export function TTSControls({ content }: TTSControlsProps) {
  const { speak, stop, isSpeaking, isLoading, error, isSupported } = useTextToSpeech()

  const handleClick = useCallback(async () => {
    if (isLoading) return
    if (isSpeaking) {
      stop()
    } else {
      await speak(content)
    }
  }, [isLoading, isSpeaking, speak, stop, content])

  const unavailable = !isSupported
  const disabled = isLoading || unavailable
  const title = error ?? (unavailable ? UI_TEXT.TTS_UNAVAILABLE : undefined)

  let ariaLabel: string = UI_TEXT.TTS_READ_ALOUD
  if (unavailable) ariaLabel = UI_TEXT.TTS_UNAVAILABLE
  if (isLoading) ariaLabel = UI_TEXT.TTS_LOADING
  if (isSpeaking) ariaLabel = UI_TEXT.TTS_STOP

  let toneClass = 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)'
  if (disabled) {
    toneClass = 'cursor-wait text-(--text-ghost)'
  } else if (error) {
    toneClass = 'text-(--error) hover:bg-(--bg-surface-hover)'
  }

  const Icon = isLoading ? Loader2 : isSpeaking ? VolumeX : Volume2
  const iconClassName = isLoading ? 'size-3.5 animate-spin' : 'size-3.5'

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled}
      className={cn(
        'flex min-h-8 min-w-8 items-center justify-center rounded-md transition-colors',
        toneClass,
      )}
      title={title}
      aria-label={ariaLabel}
    >
      <Icon className={iconClassName} />
    </button>
  )
}
