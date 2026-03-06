import { A2UI_COMPONENT_TYPES } from '@/config/constants'
import { isRecord } from '@/lib/security/runtime-safety'

const PROTOCOL_KEYS = [
  'beginRendering',
  'surfaceUpdate',
  'dataModelUpdate',
  'deleteSurface',
] as const

function isProtocolMessage(value: unknown): boolean {
  if (!isRecord(value)) return false
  return PROTOCOL_KEYS.some((key) => key in value)
}

/**
 * Stream Reader: extracts complete JSON objects from raw text using brace-depth tracking.
 * Per A2UI spec, JSONL should be one object per line, but models sometimes pretty-print.
 * This handles both cases without any validation — the client SDK handles rendering.
 */
function extractJsonObjects(source: string): unknown[] {
  const results: unknown[] = []
  let depth = 0
  let inString = false
  let escape = false
  let start = -1

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\' && inString) {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try {
          results.push(JSON.parse(source.slice(start, i + 1)))
        } catch {
          // malformed object, skip
        }
        start = -1
      }
    }
  }
  return results
}

/** Extracts A2UI protocol messages from fence content as parsed objects. */
function parseA2UIFenceObjects(payload: string): unknown[] {
  const trimmed = payload.trim()
  if (!trimmed) return []
  return extractJsonObjects(trimmed).filter(isProtocolMessage)
}

/** Extracts A2UI protocol messages from fence content. Transparent pass-through to client SDK. */
export function parseA2UIFencePayloadToJsonLines(payload: string): string[] {
  return parseA2UIFenceObjects(payload).map((obj) => JSON.stringify(obj))
}

const validComponentTypes: ReadonlySet<string> = new Set(A2UI_COMPONENT_TYPES)

export function validateA2UIComponentTypes(lines: readonly string[]): string[] {
  const found = new Set<string>()
  for (const line of lines) {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }
    if (isRecord(parsed) && 'surfaceUpdate' in parsed && isRecord(parsed.surfaceUpdate)) {
      const components = parsed.surfaceUpdate.components
      if (Array.isArray(components)) {
        for (const entry of components) {
          if (isRecord(entry) && 'component' in entry && isRecord(entry.component)) {
            for (const typeName of Object.keys(entry.component)) {
              found.add(typeName)
            }
          }
        }
      }
    }
  }
  return [...found].filter((t) => !validComponentTypes.has(t))
}
