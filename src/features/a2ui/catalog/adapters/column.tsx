'use client'

import { cn } from '@/lib/utils/cn'
import { ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ColumnComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'

const DISTRIBUTION_MAP: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  spaceBetween: 'justify-between',
  spaceAround: 'justify-around',
  spaceEvenly: 'justify-evenly',
}

const ALIGNMENT_MAP: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

export function ColumnAdapter({
  children,
  distribution,
  alignment,
  surfaceId,
}: BaseComponentProps & ColumnComponentProps) {
  const distClass = distribution ? (DISTRIBUTION_MAP[distribution] ?? 'justify-start') : 'justify-start'
  const alignClass = alignment ? (ALIGNMENT_MAP[alignment] ?? 'items-start') : 'items-start'
  const childIds = children?.explicitList ?? []

  return (
    <div className={cn('flex flex-col gap-2', distClass, alignClass)}>
      {childIds.map((id) => (
        <ComponentRenderer key={id} surfaceId={surfaceId} componentId={id} />
      ))}
    </div>
  )
}
