'use client'

import { useCallback, useEffect, useState } from 'react'
import { SHIKI_LANGS, getShikiHighlighter } from '../config/shiki-config'
import {
  LIMITS,
  UX,
  CODE_BLOCK_DEFAULT_LANG,
  SHIKI_DARK_THEME,
  SHIKI_LIGHT_THEME,
} from '@/config/constants'
import { useTheme } from 'next-themes'
import { CopyButton } from './copy-button'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { expand } from '@/lib/utils/motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

const PREVIEW_MAX_HEIGHT = `${UX.CODE_BLOCK_PREVIEW_LINES * UX.CODE_BLOCK_LINE_HEIGHT * UX.CODE_BLOCK_FONT_SIZE_REM + UX.CODE_BLOCK_PREVIEW_PADDING_REM}rem`

type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
  autoCollapse?: boolean
}

export function CodeBlock({ children, className, autoCollapse }: CodeBlockProps) {
  const code = String(children ?? '').replace(/\n$/, '')
  const match = /language-(\w+)/.exec(className ?? '')
  const lang = match?.[1] ?? CODE_BLOCK_DEFAULT_LANG
  const validLang = (SHIKI_LANGS as readonly string[]).includes(lang)
    ? lang
    : CODE_BLOCK_DEFAULT_LANG

  const lines = code.split('\n')
  const lineCount = lines.length
  const showLineNumbers = lineCount > LIMITS.CODE_BLOCK_LINE_NUMBER_THRESHOLD
  const isLargeBlock = lineCount > LIMITS.CODE_BLOCK_COLLAPSE_THRESHOLD

  const [isExpanded, setIsExpanded] = useState(!autoCollapse || !isLargeBlock)
  const toggle = useCallback(() => setIsExpanded((p) => !p), [])

  useEffect(() => {
    if (autoCollapse && isLargeBlock) {
      setIsExpanded(false)
    }
  }, [autoCollapse, isLargeBlock])

  const shouldReduce = useReducedMotion()
  const { resolvedTheme } = useTheme()
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const shikiTheme = resolvedTheme === 'light' ? SHIKI_LIGHT_THEME : SHIKI_DARK_THEME
    void (async () => {
      try {
        const highlighter = await getShikiHighlighter()
        const rendered = highlighter.codeToHtml(code, { lang: validLang, theme: shikiTheme })
        if (!cancelled) setHtml(rendered)
      } catch (error) {
        console.error('[CodeBlock] Shiki highlighting failed:', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, validLang, resolvedTheme])

  const toggleBtnClass =
    'flex w-full items-center justify-center gap-1.5 border-t border-(--border-subtle) py-1.5 text-xs text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)'

  const codeContent = html ? (
    <div
      className="[&>pre]:bg-transparent! [&>pre]:p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <pre className="p-4">
      <code className="text-(--text-secondary)">{code}</code>
    </pre>
  )

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-surface) shadow-lg">
      <div className="flex items-center justify-between border-b border-(--code-block-border) bg-(--bg-code-header) px-3.5 py-1.5">
        <span className="font-mono text-xs text-(--text-muted) tracking-[0.04em] lowercase">
          {validLang}
        </span>
        <CopyButton code={code} />
      </div>

      {isLargeBlock && !isExpanded ? (
        <>
          <div className="relative overflow-hidden">
            <div
              className="overflow-x-auto text-xs leading-[1.65]"
              data-line-numbers={showLineNumbers}
              style={{ maxHeight: PREVIEW_MAX_HEIGHT }}
            >
              {codeContent}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-(--bg-surface) to-transparent" />
          </div>
          <button type="button" onClick={toggle} className={toggleBtnClass}>
            <span>Show {lineCount} lines</span>
            <ChevronDown className="size-3.5" />
          </button>
        </>
      ) : (
        <>
          <AnimatePresence initial={false}>
            <motion.div
              {...(shouldReduce ? {} : isLargeBlock ? expand : {})}
              className="overflow-x-auto text-xs leading-[1.65]"
              data-line-numbers={showLineNumbers}
            >
              {codeContent}
            </motion.div>
          </AnimatePresence>
          {isLargeBlock && (
            <button type="button" onClick={toggle} className={toggleBtnClass}>
              <span>Collapse</span>
              <ChevronUp className="size-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
