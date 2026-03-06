'use client'

import { Blocks, Code2, Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { v0_8 } from '@a2ui-sdk/types'
import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'
import { UX } from '@/config/constants'
import { useShikiHighlight } from '@/features/markdown/hooks/use-shiki-highlight'
import { CopyButton } from '@/features/markdown/components/copy-button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { A2UIMessage } from './a2ui-message'
import { cn } from '@/lib/utils/cn'

const ARTIFACT_TABS = {
  PREVIEW: 'preview',
  CODE: 'code',
} as const

type ArtifactTab = (typeof ARTIFACT_TABS)[keyof typeof ARTIFACT_TABS]

type A2UICodeViewProps = {
  rawLines: string[]
}

function A2UICodeView({ rawLines }: A2UICodeViewProps) {
  const formattedCode = useMemo(() => {
    return rawLines
      .map((line) => {
        try {
          return JSON.stringify(JSON.parse(line), null, 2)
        } catch {
          return line
        }
      })
      .join('\n')
  }, [rawLines])

  const html = useShikiHighlight(formattedCode, 'json')

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10">
        <CopyButton code={formattedCode} />
      </div>
      <div className="overflow-x-auto text-xs leading-[1.65]">
        {html ? (
          <div
            className="[&>pre]:bg-transparent! [&>pre]:p-4"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-4">
            <code className="text-(--text-secondary)">{formattedCode}</code>
          </pre>
        )}
      </div>
    </div>
  )
}

type A2UIArtifactPanelProps = {
  messages: v0_8.A2UIMessage[]
  rawLines: string[]
  policy: RuntimeA2UIPolicy
  className?: string
}

export function A2UIArtifactPanel({
  messages,
  rawLines,
  policy,
  className,
}: A2UIArtifactPanelProps) {
  const [activeTab, setActiveTab] = useState<ArtifactTab>(ARTIFACT_TABS.PREVIEW)

  if (messages.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-surface) shadow-sm',
        className,
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab as (value: string) => void}
        className="flex flex-col gap-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-(--border-subtle) bg-(--bg-surface-hover)/40 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Blocks className="size-3.5 text-(--accent)" />
            <span className="text-xs font-semibold tracking-wide text-(--text-primary)">
              Artifact
            </span>
          </div>
          <TabsList className="h-7 rounded-lg bg-transparent p-0">
            <TabsTrigger value={ARTIFACT_TABS.PREVIEW} className="h-6 gap-1 px-2 text-[11px]">
              <Eye className="size-3" />
              Preview
            </TabsTrigger>
            <TabsTrigger value={ARTIFACT_TABS.CODE} className="h-6 gap-1 px-2 text-[11px]">
              <Code2 className="size-3" />
              Code
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={ARTIFACT_TABS.PREVIEW} className="min-h-0 flex-1">
          <div className="overflow-y-auto" style={{ maxHeight: UX.ARTIFACT_PANEL_MAX_HEIGHT_PX }}>
            <A2UIMessage messages={messages} policy={policy} />
          </div>
        </TabsContent>

        <TabsContent value={ARTIFACT_TABS.CODE} className="min-h-0 flex-1">
          <div
            className="overflow-y-auto bg-(--bg-code-header)"
            style={{ maxHeight: UX.ARTIFACT_PANEL_MAX_HEIGHT_PX }}
          >
            <A2UICodeView rawLines={rawLines} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
