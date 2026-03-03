'use client'

import { useEffect, useState } from 'react'
import { codeToHtml } from 'shiki'
import { SHIKI_LANGS } from '../config/shiki-config'
import {
  LIMITS,
  CODE_BLOCK_DEFAULT_LANG,
  SHIKI_DARK_THEME,
  SHIKI_LIGHT_THEME,
} from '@/config/constants'
import { useTheme } from 'next-themes'
import { CopyButton } from './copy-button'

type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const code = String(children ?? '').replace(/\n$/, '')
  const match = /language-(\w+)/.exec(className ?? '')
  const lang = match?.[1] ?? CODE_BLOCK_DEFAULT_LANG
  const validLang = (SHIKI_LANGS as readonly string[]).includes(lang)
    ? lang
    : CODE_BLOCK_DEFAULT_LANG

  const lines = code.split('\n')
  const showLineNumbers = lines.length > LIMITS.CODE_BLOCK_LINE_NUMBER_THRESHOLD

  const { resolvedTheme } = useTheme()
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const shikiTheme = resolvedTheme === 'light' ? SHIKI_LIGHT_THEME : SHIKI_DARK_THEME
    void (async () => {
      try {
        const rendered = await codeToHtml(code, { lang: validLang, theme: shikiTheme })
        if (!cancelled) setHtml(rendered)
      } catch {
        // Leave as plain pre/code on error
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, validLang, resolvedTheme])

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-surface) shadow-lg">
      <div className="flex items-center justify-between border-b border-(--code-block-border) bg-(--bg-code-header) px-3.5 py-1.5">
        <span className="font-mono text-xs text-(--text-muted) tracking-[0.04em] lowercase">
          {validLang}
        </span>
        <CopyButton code={code} />
      </div>

      <div className="overflow-x-auto text-xs leading-[1.65]" data-line-numbers={showLineNumbers}>
        {html ? (
          <div
            className="[&>pre]:bg-transparent! [&>pre]:p-4"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-4">
            <code className="text-(--text-secondary)">{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
