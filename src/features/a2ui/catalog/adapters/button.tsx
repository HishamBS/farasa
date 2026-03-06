'use client'

import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useDispatchAction, ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { Action } from '@a2ui-sdk/types/0.8'
import type { ButtonComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { useA2UIPolicy } from '@/features/a2ui/context/policy-context'
import { isAllowedA2UIButtonAction } from '@/lib/security/runtime-safety'

export function ButtonAdapter({
  child,
  primary,
  action: rawAction,
  surfaceId,
  componentId,
}: BaseComponentProps & ButtonComponentProps) {
  const dispatchAction = useDispatchAction()
  const policy = useA2UIPolicy()

  // Models may send action as a raw string instead of the {name, context} object the SDK expects
  const action = useMemo((): Action | undefined => {
    if (!rawAction) return undefined
    const raw: unknown = rawAction
    if (typeof raw === 'string') return { name: raw }
    return rawAction
  }, [rawAction])

  const actionAllowed = policy ? isAllowedA2UIButtonAction(action, policy.action.pattern) : false

  const handleClick = useCallback(() => {
    if (actionAllowed && action) dispatchAction(surfaceId, componentId, action)
  }, [action, actionAllowed, componentId, dispatchAction, surfaceId])

  return (
    <Button
      variant={primary ? 'default' : 'outline'}
      size="default"
      onClick={handleClick}
      disabled={!actionAllowed}
    >
      {child ? <ComponentRenderer surfaceId={surfaceId} componentId={child} /> : null}
    </Button>
  )
}
