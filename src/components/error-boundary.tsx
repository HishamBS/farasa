'use client'

import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            className="flex items-center justify-center p-6 text-sm text-(--text-muted)"
          >
            Something went wrong. Please try refreshing the page.
          </div>
        )
      )
    }
    return this.props.children
  }
}
