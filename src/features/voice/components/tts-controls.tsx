'use client'

import { useCallback } from 'react'
import { Volume2, VolumeX, Loader2 } from 'lucide-react'
import { useTextToSpeech } from '../hooks/use-text-to-speech'
import { cn } from '@/lib/utils/cn'
import { UI_TEXT, VOICE_TTS_STATES } from '@/config/constants'

type TTSControlsProps = {
  content: string
  messageId: string
}

export function TTSControls({ content, messageId }: TTSControlsProps) {
  const { speak, stop, status, error, isReady } = useTextToSpeech()
  const effectiveStatus = isReady ? status : VOICE_TTS_STATES.IDLE

  const handleClick = useCallback(async () => {
    if (status === VOICE_TTS_STATES.LOADING) return
    if (status === VOICE_TTS_STATES.SPEAKING) {
      stop()
    } else {
      await speak(content, messageId)
    }
  }, [status, speak, stop, content, messageId])

  type TtsControlPresentation = {
    ariaLabel: string
    disabled: boolean
    toneClass: string
    icon: typeof Volume2
    iconClassName: string
  }

  const presentationByStatus: Record<
    (typeof VOICE_TTS_STATES)[keyof typeof VOICE_TTS_STATES],
    TtsControlPresentation
  > = {
    [VOICE_TTS_STATES.IDLE]: {
      ariaLabel: UI_TEXT.TTS_READ_ALOUD,
      disabled: false,
      toneClass: 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)',
      icon: Volume2,
      iconClassName: 'size-3.5',
    },
    [VOICE_TTS_STATES.LOADING]: {
      ariaLabel: UI_TEXT.TTS_LOADING,
      disabled: true,
      toneClass: 'cursor-wait text-(--text-ghost)',
      icon: Loader2,
      iconClassName: 'size-3.5 animate-spin',
    },
    [VOICE_TTS_STATES.SPEAKING]: {
      ariaLabel: UI_TEXT.TTS_STOP,
      disabled: false,
      toneClass: 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)',
      icon: VolumeX,
      iconClassName: 'size-3.5',
    },
    [VOICE_TTS_STATES.ERROR]: {
      ariaLabel: error ?? UI_TEXT.TTS_UNAVAILABLE,
      disabled: false,
      toneClass: 'text-(--error) hover:bg-(--bg-surface-hover)',
      icon: Volume2,
      iconClassName: 'size-3.5',
    },
    [VOICE_TTS_STATES.UNAVAILABLE]: {
      ariaLabel: error ?? UI_TEXT.TTS_UNAVAILABLE,
      disabled: true,
      toneClass: 'cursor-not-allowed text-(--text-ghost)',
      icon: Volume2,
      iconClassName: 'size-3.5',
    },
  }

  const presentation = presentationByStatus[effectiveStatus]
  const Icon = presentation.icon

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={presentation.disabled}
      className={cn(
        'flex min-h-8 min-w-8 items-center justify-center rounded-md transition-colors',
        presentation.toneClass,
      )}
      title={error ?? undefined}
      aria-label={presentation.ariaLabel}
    >
      <Icon className={presentation.iconClassName} />
    </button>
  )
}
