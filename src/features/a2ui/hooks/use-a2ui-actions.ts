'use client'

import { useCallback } from 'react'

export function useA2UIActions() {
  const handleAction = useCallback((action: string, payload?: unknown) => {
    // Action dispatch to tRPC mutations — extend per feature as actions are defined.
    // Each A2UI action name maps to a specific tRPC mutation.
    void action
    void payload
  }, [])

  return { handleAction }
}
