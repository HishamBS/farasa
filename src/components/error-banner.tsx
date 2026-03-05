'use client'

import { AlertCircle } from 'lucide-react'

type ErrorBannerProps = {
  message: string
  onRetry?: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="mx-auto w-full max-w-240 px-4 py-2">
      <div className="flex items-center gap-2 rounded-lg border border-(--error)/20 bg-(--error)/5 px-3 py-2 text-sm text-(--error)">
        <AlertCircle className="size-4 shrink-0" />
        <span className="flex-1">{message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-(--error)/40 px-2 py-1 text-xs font-medium text-(--error) transition-colors hover:bg-(--error)/10"
            aria-label="Retry last message"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
