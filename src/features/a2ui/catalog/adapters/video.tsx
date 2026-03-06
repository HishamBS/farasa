'use client'

import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { VideoComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'

export function VideoAdapter({ surfaceId, url }: BaseComponentProps & VideoComponentProps) {
  const safeUrl = normalizeValueSource(url)
  const resolvedUrl = useDataBinding<string>(surfaceId, safeUrl, '')

  if (!resolvedUrl) return null

  return (
    <div className="overflow-hidden rounded-lg border border-(--border-default)">
      <video src={resolvedUrl} controls className="w-full" preload="metadata">
        <track kind="captions" />
      </video>
    </div>
  )
}
