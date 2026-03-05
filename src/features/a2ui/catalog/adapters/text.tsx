'use client'

import { cn } from '@/lib/utils/cn'
import type { BaseComponentProps } from '../types'
import type { TextComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'

export function TextAdapter({ text, usageHint }: BaseComponentProps & TextComponentProps) {
  const safeText = normalizeValueSource(text)
  const resolved = safeText && 'literalString' in safeText ? safeText.literalString : undefined

  if (!resolved) return null

  return (
    <span
      className={cn(
        usageHint === 'h1' && 'text-2xl font-bold text-(--text-primary)',
        usageHint === 'h2' && 'text-xl font-semibold text-(--text-primary)',
        usageHint === 'h3' && 'text-lg font-semibold text-(--text-primary)',
        usageHint === 'h4' && 'text-base font-medium text-(--text-primary)',
        usageHint === 'h5' && 'text-sm font-medium text-(--text-primary)',
        usageHint === 'caption' && 'text-xs text-(--text-muted)',
        (!usageHint || usageHint === 'body') && 'text-sm text-(--text-primary)',
      )}
    >
      {resolved}
    </span>
  )
}
