'use client'

import { Eye } from 'lucide-react'
import type { v0_8 } from '@a2ui-sdk/types'
import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'
import { A2UIMessage } from './a2ui-message'
import { cn } from '@/lib/utils/cn'

type A2UIArtifactPanelProps = {
  messages: v0_8.A2UIMessage[]
  policy: RuntimeA2UIPolicy
  className?: string
}

export function A2UIArtifactPanel({ messages, policy, className }: A2UIArtifactPanelProps) {
  if (messages.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-(--border-default) bg-(--bg-surface)',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-(--border-subtle) bg-(--bg-surface-hover)/40 px-3 py-2">
        <Eye className="size-3.5 text-(--text-ghost)" />
        <span className="text-xs font-medium text-(--text-secondary)">Preview</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <A2UIMessage messages={messages} policy={policy} />
      </div>
    </div>
  )
}
