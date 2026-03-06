'use client'

import {
  A2UIProvider,
  A2UIRenderer,
  useSurfaceContext,
  useA2UIMessageHandler,
} from '@a2ui-sdk/react/0.8'
import type { v0_8 } from '@a2ui-sdk/types'
import type { ActionPayload } from '@a2ui-sdk/types/0.8'
import React, { useEffect, useRef } from 'react'
import { customCatalog } from '../catalog/custom-catalog'
import { useA2UIActions } from '../hooks/use-a2ui-actions'
import { A2UIPolicyProvider } from '../context/policy-context'
import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'

type A2UIMessageProps = {
  messages: v0_8.A2UIMessage[]
  policy: RuntimeA2UIPolicy
}

type A2UIContentProps = {
  onAction: (action: ActionPayload) => void
}

function A2UIContent({ onAction }: A2UIContentProps) {
  const { surfaces } = useSurfaceContext()
  if (surfaces.size === 0) return null
  return (
    <div className="p-3">
      <A2UIRenderer onAction={onAction} />
    </div>
  )
}

/**
 * Processes A2UI messages incrementally using the SDK's useA2UIMessageHandler hook.
 * This preserves user edits and form state — unlike the messages prop approach
 * which clears all state on every array change.
 */
function A2UIMessageProcessor({ messages }: { messages: v0_8.A2UIMessage[] }) {
  const { processMessage, processMessages, clear } = useA2UIMessageHandler()
  const processedCountRef = useRef(0)

  useEffect(() => {
    if (messages.length === 0) {
      processedCountRef.current = 0
      clear()
      return
    }

    if (messages.length < processedCountRef.current) {
      clear()
      processMessages(messages)
      processedCountRef.current = messages.length
      return
    }

    const newMessages = messages.slice(processedCountRef.current)
    for (const msg of newMessages) {
      processMessage(msg)
    }
    processedCountRef.current = messages.length
  }, [messages, processMessage, processMessages, clear])

  return null
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

export function A2UIMessage({ messages, policy }: A2UIMessageProps) {
  const { handleAction } = useA2UIActions()

  if (messages.length === 0) return null

  return (
    <A2UIPolicyProvider policy={policy}>
      <A2UIProvider catalog={customCatalog}>
        <A2UIMessageProcessor messages={messages} />
        <A2UIErrorBoundary>
          <A2UIContent onAction={handleAction} />
        </A2UIErrorBoundary>
      </A2UIProvider>
    </A2UIPolicyProvider>
  )
}
