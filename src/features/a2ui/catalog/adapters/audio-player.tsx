'use client'

import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { AudioPlayerComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'

export function AudioPlayerAdapter({
  surfaceId,
  url,
  description,
}: BaseComponentProps & AudioPlayerComponentProps) {
  const safeUrl = normalizeValueSource(url)
  const safeDescription = normalizeValueSource(description)
  const resolvedUrl = useDataBinding<string>(surfaceId, safeUrl, '')
  const resolvedDescription = useDataBinding<string>(surfaceId, safeDescription, '')

  if (!resolvedUrl) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-(--border-default) bg-(--bg-surface-hover)/40 p-3">
      {resolvedDescription && (
        <span className="text-sm text-(--text-secondary)">{resolvedDescription}</span>
      )}
      <audio src={resolvedUrl} controls className="w-full" preload="metadata">
        <track kind="captions" />
      </audio>
    </div>
  )
}
