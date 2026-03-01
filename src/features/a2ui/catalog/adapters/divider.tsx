'use client'

import type { BaseComponentProps } from '../types'
import type { DividerComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'

export function DividerAdapter({ axis }: BaseComponentProps & DividerComponentProps) {
  if (axis === 'vertical') {
    return <div className="self-stretch w-px bg-(--border-subtle)" />
  }
  return <hr className="border-(--border-subtle)" />
}
