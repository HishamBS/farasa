'use client'

import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useDispatchAction, useDataModelContext, ComponentRenderer } from '@a2ui-sdk/react/0.8'
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
  const { getDataModel } = useDataModelContext()
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
    if (!actionAllowed || !action) return

    // When the model provides explicit context entries, use them directly
    if (action.context && action.context.length > 0) {
      dispatchAction(surfaceId, componentId, action)
      return
    }

    // Models often omit context — inject the full data model so form values
    // (written by ensureWritablePath in interactive adapters) reach the action handler
    const model = getDataModel(surfaceId)
    const contextEntries = Object.entries(model).map(([key, _value]) => ({
      key,
      value: { path: key },
    }))
    const enrichedAction: Action = { ...action, context: contextEntries }
    dispatchAction(surfaceId, componentId, enrichedAction)
  }, [action, actionAllowed, componentId, dispatchAction, getDataModel, surfaceId])

  return (
    <Button
      variant={primary ? 'default' : 'outline'}
      size="lg"
      className={
        primary ? 'bg-(--accent) text-white hover:bg-(--accent-hover) font-medium' : undefined
      }
      onClick={handleClick}
      disabled={!actionAllowed}
    >
      {child ? <ComponentRenderer surfaceId={surfaceId} componentId={child} /> : null}
    </Button>
  )
}
