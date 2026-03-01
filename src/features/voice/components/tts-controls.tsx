'use client'

import { useCallback } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useTextToSpeech } from '../hooks/use-text-to-speech'

type TTSControlsProps = {
  content: string
}

export function TTSControls({ content }: TTSControlsProps) {
  const { speak, stop, isSpeaking, isSupported } = useTextToSpeech()

  const handleClick = useCallback(() => {
    if (isSpeaking) {
      stop()
    } else {
      speak(content)
    }
  }, [isSpeaking, speak, stop, content])

  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex min-h-8 min-w-8 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
      aria-label={isSpeaking ? 'Stop reading' : 'Read aloud'}
    >
      {isSpeaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
    </button>
  )
}
