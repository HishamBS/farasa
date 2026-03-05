'use client'

import { useState, useCallback } from 'react'
import { UX } from '@/config/constants'
import { cn } from '@/lib/utils/cn'

type CopyButtonProps = {
  code: string
}

export function CopyButton({ code }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), UX.COPY_FEEDBACK_DURATION_MS)
    } catch {
      // Clipboard access denied — graceful no-op
    }
  }, [code])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-(--bg-surface-hover)',
        copied ? 'text-success' : 'text-(--text-muted)',
      )}
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
