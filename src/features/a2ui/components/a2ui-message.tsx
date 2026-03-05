'use client'

import { A2UIProvider, A2UIRenderer, useSurfaceContext } from '@a2ui-sdk/react/0.8'
import type { v0_8 } from '@a2ui-sdk/types'
import type { ActionPayload } from '@a2ui-sdk/types/0.8'
import React from 'react'
import { customCatalog } from '../catalog/custom-catalog'
import { useA2UIActions } from '../hooks/use-a2ui-actions'
import { trpc } from '@/trpc/provider'
import { A2UIPolicyProvider } from '../context/policy-context'

type A2UIMessageProps = {
  messages: v0_8.A2UIMessage[]
}

type A2UIContentProps = {
  onAction: (action: ActionPayload) => void
}

function A2UIContent({ onAction }: A2UIContentProps) {
  const { surfaces } = useSurfaceContext()

  if (surfaces.size === 0) return null

  return (
    <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-3">
      <A2UIRenderer onAction={onAction} />
    </div>
  )
}

class A2UIErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[a2ui] render failure:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-3 text-sm text-(--text-muted)">
          Interactive UI could not be rendered for this message.
        </div>
      )
    }
    return this.props.children
  }
}

export function A2UIMessage({ messages }: A2UIMessageProps) {
  const { handleAction } = useA2UIActions()
  const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()
  const policy = runtimeConfigQuery.data?.safety.a2ui

  if (!policy || messages.length === 0) return null

  return (
    <A2UIPolicyProvider policy={policy}>
      <A2UIProvider messages={messages} catalog={customCatalog}>
        <A2UIErrorBoundary>
          <A2UIContent onAction={handleAction} />
        </A2UIErrorBoundary>
      </A2UIProvider>
    </A2UIPolicyProvider>
  )
}
