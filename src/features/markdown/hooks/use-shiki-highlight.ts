'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { SHIKI_DARK_THEME, SHIKI_LIGHT_THEME } from '@/config/constants'
import { getShikiHighlighter } from '../config/shiki-config'

/**
 * Shared hook for Shiki syntax highlighting.
 * Returns highlighted HTML string (empty while loading or on error).
 */
export function useShikiHighlight(code: string, lang: string): string {
  const { resolvedTheme } = useTheme()
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const shikiTheme = resolvedTheme === 'light' ? SHIKI_LIGHT_THEME : SHIKI_DARK_THEME
    void (async () => {
      try {
        const highlighter = await getShikiHighlighter()
        const rendered = highlighter.codeToHtml(code, { lang, theme: shikiTheme })
        if (!cancelled) setHtml(rendered)
      } catch (error) {
        console.error('[shiki] highlighting failed:', error)
        if (!cancelled) setHtml('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, lang, resolvedTheme])

  return html
}
