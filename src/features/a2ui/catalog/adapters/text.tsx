'use client'

import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { TextComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'

export function TextAdapter({
  surfaceId,
  text,
  usageHint,
}: BaseComponentProps & TextComponentProps) {
  const safeText = normalizeValueSource(text)
  const resolved = useDataBinding<string>(surfaceId, safeText, '')

  if (!resolved) return null

  switch (usageHint) {
    case 'h1':
      return <h1 className="text-2xl font-bold tracking-tight text-(--text-primary)">{resolved}</h1>
    case 'h2':
      return (
        <h2 className="text-xl font-semibold tracking-tight text-(--text-primary)">{resolved}</h2>
      )
    case 'h3':
      return <h3 className="text-lg font-semibold text-(--text-primary)">{resolved}</h3>
    case 'h4':
      return <h4 className="text-base font-medium text-(--text-primary)">{resolved}</h4>
    case 'h5':
      return <h5 className="text-sm font-medium text-(--text-secondary)">{resolved}</h5>
    case 'caption':
      return <span className="text-xs leading-relaxed text-(--text-muted)">{resolved}</span>
    default:
      return <p className="text-sm leading-relaxed text-(--text-primary)">{resolved}</p>
  }
}
