'use client'

import { cn } from '@/lib/utils/cn'
import { ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ColumnComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { ALIGNMENT_MAP, DISTRIBUTION_MAP } from './flex-maps'

export function ColumnAdapter({
  children,
  distribution,
  alignment,
  surfaceId,
}: BaseComponentProps & ColumnComponentProps) {
  const distClass = distribution
    ? (DISTRIBUTION_MAP[distribution] ?? 'justify-start')
    : 'justify-start'
  const alignClass = alignment ? (ALIGNMENT_MAP[alignment] ?? 'items-stretch') : 'items-stretch'
  const childIds = children?.explicitList ?? []

  return (
    <div className={cn('flex flex-col gap-4', distClass, alignClass)}>
      {childIds.map((id) => (
        <ComponentRenderer key={id} surfaceId={surfaceId} componentId={id} />
      ))}
    </div>
  )
}
