import { sanitizeA2UIJsonLine } from '@/lib/security/runtime-safety'
import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'
import type { v0_8 } from '@a2ui-sdk/types'

const PROTOCOL_KEYS = [
  'beginRendering',
  'surfaceUpdate',
  'dataModelUpdate',
  'deleteSurface',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isProtocolMessage(value: unknown): value is v0_8.A2UIMessage {
  if (!isRecord(value)) return false
  return PROTOCOL_KEYS.some((key) => key in value)
}

function parseWholeJson(source: string): unknown[] {
  try {
    const parsed = JSON.parse(source)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

function parseJsonLines(source: string): unknown[] {
  const lines = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const parsed: unknown[] = []
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line))
    } catch {
      return []
    }
  }
  return parsed
}

function parseConcatenatedJson(source: string): unknown[] {
  const parsed: unknown[] = []
  const length = source.length
  let cursor = 0

  while (cursor < length) {
    while (cursor < length && /[\s,]/.test(source[cursor] ?? '')) {
      cursor += 1
    }
    if (cursor >= length) break

    const first = source[cursor]
    if (first !== '{' && first !== '[') {
      cursor += 1
      continue
    }

    let depth = 0
    let inString = false
    let escaped = false
    let foundEnd = false

    for (let index = cursor; index < length; index += 1) {
      const char = source[index]
      if (char === undefined) continue

      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
        continue
      }
      if (char === '{' || char === '[') {
        depth += 1
        continue
      }
      if (char === '}' || char === ']') {
        depth -= 1
        if (depth === 0) {
          const slice = source.slice(cursor, index + 1)
          try {
            const value = JSON.parse(slice)
            if (Array.isArray(value)) {
              parsed.push(...value)
            } else {
              parsed.push(value)
            }
          } catch {
            return parsed
          }
          cursor = index + 1
          foundEnd = true
          break
        }
      }
    }

    if (!foundEnd) break
  }

  return parsed
}

function parseFencePayload(source: string): unknown[] {
  const trimmed = source.trim()
  if (!trimmed) return []

  const whole = parseWholeJson(trimmed)
  if (whole.length > 0) return whole

  const jsonLines = parseJsonLines(trimmed)
  if (jsonLines.length > 0) return jsonLines

  return parseConcatenatedJson(trimmed)
}

function validateProtocolStructure(message: v0_8.A2UIMessage): boolean {
  const msg = message as Record<string, unknown>
  if (msg.beginRendering) {
    const br = msg.beginRendering as Record<string, unknown>
    if (typeof br.surfaceId !== 'string' || typeof br.root !== 'string') {
      console.warn('[a2ui] beginRendering missing surfaceId or root:', JSON.stringify(br))
      return false
    }
  }
  if (msg.surfaceUpdate) {
    const su = msg.surfaceUpdate as Record<string, unknown>
    if (typeof su.surfaceId !== 'string' || !Array.isArray(su.components)) {
      console.warn('[a2ui] surfaceUpdate missing surfaceId or components:', JSON.stringify(su))
      return false
    }
  }
  if (msg.dataModelUpdate) {
    const dm = msg.dataModelUpdate as Record<string, unknown>
    if (typeof dm.surfaceId !== 'string') {
      console.warn('[a2ui] dataModelUpdate missing surfaceId:', JSON.stringify(dm))
      return false
    }
  }
  if (msg.deleteSurface) {
    const ds = msg.deleteSurface as Record<string, unknown>
    if (typeof ds.surfaceId !== 'string') {
      console.warn('[a2ui] deleteSurface missing surfaceId:', JSON.stringify(ds))
      return false
    }
  }
  return true
}

function serializeSafeA2UIMessages(
  messages: ReadonlyArray<v0_8.A2UIMessage>,
  policy: RuntimeA2UIPolicy,
): string[] {
  const lines: string[] = []
  for (const message of messages) {
    if (!validateProtocolStructure(message)) continue
    const serialized = JSON.stringify(message)
    const sanitized = sanitizeA2UIJsonLine(serialized, policy)
    if (sanitized) {
      lines.push(sanitized)
    }
  }
  return lines
}

export function parseA2UIFencePayloadToJsonLines(
  payload: string,
  policy: RuntimeA2UIPolicy,
): string[] {
  const parsed = parseFencePayload(payload)
  if (parsed.length === 0) {
    return []
  }

  const protocolMessages = parsed.filter(isProtocolMessage)
  if (protocolMessages.length === 0) {
    return []
  }

  return serializeSafeA2UIMessages(protocolMessages, policy)
}
