'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useDispatchAction, ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ButtonComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'

export function ButtonAdapter({
  child,
  primary,
  action,
  surfaceId,
  componentId,
}: BaseComponentProps & ButtonComponentProps) {
  const dispatchAction = useDispatchAction()

  const handleClick = useCallback(() => {
    if (action) dispatchAction(surfaceId, componentId, action)
  }, [dispatchAction, surfaceId, componentId, action])

  return (
    <Button
      variant={primary ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}
      className="min-h-11"
    >
      {child ? <ComponentRenderer surfaceId={surfaceId} componentId={child} /> : null}
    </Button>
  )
}
