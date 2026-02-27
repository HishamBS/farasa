'use client'

import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ImageComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'

export function ImageAdapter({ surfaceId, url, fit }: BaseComponentProps & ImageComponentProps) {
  const resolvedUrl = useDataBinding<string>(surfaceId, url, '')

  if (!resolvedUrl) return null

  const objectFit = fit ?? 'contain'

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedUrl}
      alt=""
      className="max-w-full rounded-xl"
      style={{ objectFit }}
    />
  )
}
