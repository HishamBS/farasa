'use client'

import { CodeBlock } from '@/features/markdown/components/code-block'
import type { BaseComponentProps } from '../types'

type CodeBlockCustomProps = {
  code?: string
  language?: string
}

export function CodeBlockAdapter({ code, language }: BaseComponentProps & CodeBlockCustomProps) {
  if (!code) return null

  return <CodeBlock className={language ? `language-${language}` : undefined}>{code}</CodeBlock>
}
