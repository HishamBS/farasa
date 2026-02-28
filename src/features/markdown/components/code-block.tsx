'use client'

import { useEffect, useState } from 'react'
import { codeToHtml } from 'shiki'
import { SHIKI_LANGS } from '../config/shiki-config'
import {
  LIMITS,
  CODE_BLOCK_FALLBACK_LANG,
  SHIKI_DARK_THEME,
  SHIKI_LIGHT_THEME,
} from '@/config/constants'
import { useTheme } from '@/lib/utils/use-theme'
import { CopyButton } from './copy-button'

type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const code = String(children ?? '').replace(/\n$/, '')
  const match = /language-(\w+)/.exec(className ?? '')
  const lang = match?.[1] ?? CODE_BLOCK_FALLBACK_LANG
  const validLang = (SHIKI_LANGS as readonly string[]).includes(lang)
    ? lang
    : CODE_BLOCK_FALLBACK_LANG

  const lines = code.split('\n')
  const showLineNumbers = lines.length > LIMITS.CODE_BLOCK_LINE_NUMBER_THRESHOLD

  const { theme } = useTheme()
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const shikiTheme = theme === 'light' ? SHIKI_LIGHT_THEME : SHIKI_DARK_THEME
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
  }, [code, validLang, theme])

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[--border-default] bg-[--bg-surface] shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between border-b border-[--border-subtle] bg-[--bg-code-header] px-3.5 py-2.5">
        <span className="font-mono text-xs text-[--text-muted]">{validLang}</span>
        <CopyButton code={code} />
      </div>

      <div
        className="overflow-x-auto text-[0.8rem] leading-relaxed"
        data-line-numbers={showLineNumbers}
      >
        {html ? (
          <div
            className="[&>pre]:!bg-transparent [&>pre]:p-3.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-4">
            <code className="text-[--text-secondary]">{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
