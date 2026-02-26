'use client'

import { useState, useCallback } from 'react'
import { Check, Copy } from 'lucide-react'
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
      className="flex items-center gap-1 text-xs text-[--text-muted] transition-colors hover:text-[--text-primary]"
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
