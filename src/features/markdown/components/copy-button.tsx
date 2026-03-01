'use client'

import { useState, useCallback } from 'react'
import { UX } from '@/config/constants'

type CopyButtonProps = {
  code: string
}

export function CopyButton({ code }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), UX.COPY_FEEDBACK_DURATION_MS)
  }, [code])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs text-(--text-muted) transition-colors hover:text-(--text-secondary)"
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
