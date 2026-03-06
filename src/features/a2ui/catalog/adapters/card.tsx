'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { CardComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'

export function CardAdapter({ child, surfaceId }: BaseComponentProps & CardComponentProps) {
  return (
    <Card className="border-(--border-subtle) bg-(--bg-surface) shadow-sm transition-shadow hover:shadow-md">
      <CardContent>
        {child ? <ComponentRenderer surfaceId={surfaceId} componentId={child} /> : null}
      </CardContent>
    </Card>
  )
}
