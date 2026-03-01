'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useDispatchAction, ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ButtonComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { useA2UIPolicy } from '@/features/a2ui/context/policy-context'
import { isAllowedA2UIButtonAction } from '@/lib/security/runtime-safety'

export function ButtonAdapter({
  child,
  primary,
  action,
  surfaceId,
  componentId,
}: BaseComponentProps & ButtonComponentProps) {
  const dispatchAction = useDispatchAction()
  const policy = useA2UIPolicy()
  const actionAllowed = policy ? isAllowedA2UIButtonAction(action, policy.action.pattern) : false

  const handleClick = useCallback(() => {
    if (actionAllowed && action) dispatchAction(surfaceId, componentId, action)
  }, [action, actionAllowed, componentId, dispatchAction, surfaceId])

  return (
    <Button
      variant={primary ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}
      disabled={!actionAllowed}
      className="min-h-11"
    >
      {child ? <ComponentRenderer surfaceId={surfaceId} componentId={child} /> : null}
    </Button>
  )
}
