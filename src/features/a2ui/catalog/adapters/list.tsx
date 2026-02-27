'use client'

import { cn } from '@/lib/utils/cn'
import { ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ListComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'

const ALIGNMENT_MAP: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

export function ListAdapter({
  children,
  direction,
  alignment,
  surfaceId,
}: BaseComponentProps & ListComponentProps) {
  const alignClass = alignment ? (ALIGNMENT_MAP[alignment] ?? 'items-start') : 'items-start'
  const isHorizontal = direction === 'horizontal'
  const childIds = children?.explicitList ?? []

  return (
    <div
      className={cn(
        'flex gap-2',
        isHorizontal ? 'flex-row flex-wrap' : 'flex-col',
        alignClass,
      )}
    >
      {childIds.map((id) => (
        <ComponentRenderer key={id} surfaceId={surfaceId} componentId={id} />
      ))}
    </div>
  )
}
