'use client'

import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { IconComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'

export function IconAdapter({ surfaceId, name }: BaseComponentProps & IconComponentProps) {
  const safeName = normalizeValueSource(name)
  const resolvedName = useDataBinding<string>(surfaceId, safeName, '')

  if (!resolvedName) return null

  return (
    <span
      className="inline-flex size-5 items-center justify-center text-sm text-(--text-secondary)"
      role="img"
      aria-label={resolvedName}
    >
      {resolvedName}
    </span>
  )
}
