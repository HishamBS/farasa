import { createHighlighter, type Highlighter } from 'shiki'
import { SHIKI_DARK_THEME, SHIKI_LIGHT_THEME } from '@/config/constants'

export const SHIKI_LANGS = [
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
  'css',
  'html',
  'json',
  'yaml',
  'bash',
  'shell',
  'sql',
  'markdown',
  'tsx',
  'jsx',
] as const

// Singleton highlighter — pre-loads themes and languages once,
// avoids lazy dynamic imports that fail in standalone Docker builds
let highlighterPromise: Promise<Highlighter> | null = null

export function getShikiHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
      langs: [...SHIKI_LANGS],
    })
  }
  return highlighterPromise
}
