'use client'

import { useCallback } from 'react'
import { Volume2, VolumeX, Loader2 } from 'lucide-react'
import { useTextToSpeech } from '../hooks/use-text-to-speech'
import { cn } from '@/lib/utils/cn'

type TTSControlsProps = {
  content: string
}

export function TTSControls({ content }: TTSControlsProps) {
  const { speak, stop, isSpeaking, isLoading } = useTextToSpeech()

  const handleClick = useCallback(async () => {
    if (isLoading) return
    if (isSpeaking) {
      stop()
    } else {
      await speak(content)
    }
  }, [isLoading, isSpeaking, speak, stop, content])

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isLoading}
      className={cn(
        'flex min-h-8 min-w-8 items-center justify-center rounded-md transition-colors',
        isLoading
          ? 'cursor-wait text-(--text-ghost)'
          : 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)',
      )}
      aria-label={isSpeaking ? 'Stop reading' : isLoading ? 'Loading audio…' : 'Read aloud'}
    >
      {isLoading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : isSpeaking ? (
        <VolumeX className="size-3.5" />
      ) : (
        <Volume2 className="size-3.5" />
      )}
    </button>
  )
}
