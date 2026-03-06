import { A2UI_COMPONENT_TYPES } from '@/config/constants'
import { isRecord, sanitizeA2UIJsonLine } from '@/lib/security/runtime-safety'
import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'
import type { v0_8 } from '@a2ui-sdk/types'

const PROTOCOL_KEYS = [
  'beginRendering',
  'surfaceUpdate',
  'dataModelUpdate',
  'deleteSurface',
] as const

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
      console.warn('[a2ui] skipping malformed JSONL line:', line.slice(0, 80))
      continue
    }
  }
  return parsed
}

function parseFencePayload(source: string): unknown[] {
  const trimmed = source.trim()
  if (!trimmed) return []

  const whole = parseWholeJson(trimmed)
  if (whole.length > 0) return whole

  const jsonLines = parseJsonLines(trimmed)
  return jsonLines
}

function validateProtocolStructure(message: v0_8.A2UIMessage): boolean {
  const raw: unknown = message
  if (!isRecord(raw)) return false

  if ('beginRendering' in raw) {
    if (!isRecord(raw.beginRendering)) return false
    const br = raw.beginRendering
    if (typeof br.surfaceId !== 'string' || typeof br.root !== 'string') {
      console.warn('[a2ui] beginRendering missing surfaceId or root, keys:', Object.keys(br))
      return false
    }
  }
  if ('surfaceUpdate' in raw) {
    if (!isRecord(raw.surfaceUpdate)) return false
    const su = raw.surfaceUpdate
    if (typeof su.surfaceId !== 'string' || !Array.isArray(su.components)) {
      console.warn('[a2ui] surfaceUpdate missing surfaceId or components, keys:', Object.keys(su))
      return false
    }
  }
  if ('dataModelUpdate' in raw) {
    if (!isRecord(raw.dataModelUpdate)) return false
    const dm = raw.dataModelUpdate
    if (typeof dm.surfaceId !== 'string') {
      console.warn('[a2ui] dataModelUpdate missing surfaceId, keys:', Object.keys(dm))
      return false
    }
  }
  if ('deleteSurface' in raw) {
    if (!isRecord(raw.deleteSurface)) return false
    const ds = raw.deleteSurface
    if (typeof ds.surfaceId !== 'string') {
      console.warn('[a2ui] deleteSurface missing surfaceId, keys:', Object.keys(ds))
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

const validComponentTypes: ReadonlySet<string> = new Set(A2UI_COMPONENT_TYPES)

type SurfaceGraphState = {
  rootId: string | null
  componentIds: Set<string>
  childReferences: Set<string>
}

function getOrCreateSurfaceState(
  surfaces: Map<string, SurfaceGraphState>,
  surfaceId: string,
): SurfaceGraphState {
  const existing = surfaces.get(surfaceId)
  if (existing) return existing
  const created: SurfaceGraphState = {
    rootId: null,
    componentIds: new Set<string>(),
    childReferences: new Set<string>(),
  }
  surfaces.set(surfaceId, created)
  return created
}

function collectChildReferences(value: unknown, refs: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectChildReferences(item, refs)
    }
    return
  }
  if (!isRecord(value)) return

  if ('children' in value && isRecord(value.children)) {
    const explicitList = value.children.explicitList
    if (Array.isArray(explicitList)) {
      for (const childId of explicitList) {
        if (typeof childId === 'string') refs.add(childId)
      }
    }
  }

  for (const child of Object.values(value)) {
    collectChildReferences(child, refs)
  }
}

function validateSurfaceGraph(messages: ReadonlyArray<v0_8.A2UIMessage>): boolean {
  const surfaces = new Map<string, SurfaceGraphState>()

  for (const message of messages) {
    const raw: unknown = message
    if (!isRecord(raw)) continue

    if ('beginRendering' in raw && isRecord(raw.beginRendering)) {
      const surfaceId = raw.beginRendering.surfaceId
      const rootId = raw.beginRendering.root
      if (typeof surfaceId !== 'string' || typeof rootId !== 'string') {
        return false
      }
      const state = getOrCreateSurfaceState(surfaces, surfaceId)
      state.rootId = rootId
    }

    if ('surfaceUpdate' in raw && isRecord(raw.surfaceUpdate)) {
      const surfaceId = raw.surfaceUpdate.surfaceId
      const components = raw.surfaceUpdate.components
      if (typeof surfaceId !== 'string' || !Array.isArray(components)) {
        return false
      }

      const state = getOrCreateSurfaceState(surfaces, surfaceId)
      for (const componentEntry of components) {
        if (!isRecord(componentEntry)) return false
        const componentId = componentEntry.id
        if (typeof componentId !== 'string' || componentId.length === 0) return false
        if (state.componentIds.has(componentId)) return false
        state.componentIds.add(componentId)

        if ('component' in componentEntry && isRecord(componentEntry.component)) {
          collectChildReferences(componentEntry.component, state.childReferences)
        }
      }
    }
  }

  for (const [surfaceId, state] of surfaces) {
    if (state.rootId && !state.componentIds.has(state.rootId)) {
      console.warn('[a2ui] root component id missing in surface update:', surfaceId)
      return false
    }
    for (const childId of state.childReferences) {
      if (!state.componentIds.has(childId)) {
        console.warn('[a2ui] child component reference missing:', surfaceId, childId)
        return false
      }
    }
  }

  return true
}

function collectComponentTypes(value: unknown, found: Set<string>): void {
  if (!isRecord(value)) return

  if ('beginRendering' in value && isRecord(value.beginRendering)) {
    // root is a component ID, not a type name — skip it for type validation
  }

  if ('surfaceUpdate' in value && isRecord(value.surfaceUpdate)) {
    const components = value.surfaceUpdate.components
    if (Array.isArray(components)) {
      for (const entry of components) {
        collectComponentTypesFromNode(entry, found)
      }
    }
  }
}

function collectComponentTypesFromNode(value: unknown, found: Set<string>): void {
  if (!isRecord(value)) return

  if ('component' in value && isRecord(value.component)) {
    for (const typeName of Object.keys(value.component)) {
      found.add(typeName)
      const inner = value.component[typeName]
      if (isRecord(inner) && 'components' in inner && Array.isArray(inner.components)) {
        for (const child of inner.components) {
          collectComponentTypesFromNode(child, found)
        }
      }
    }
  }
}

export function validateA2UIComponentTypes(lines: readonly string[]): string[] {
  const found = new Set<string>()
  for (const line of lines) {
    try {
      collectComponentTypes(JSON.parse(line), found)
    } catch (error) {
      console.warn('[a2ui] failed to parse line for component type validation:', error)
      continue
    }
  }
  return [...found].filter((t) => !validComponentTypes.has(t))
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
  if (!validateSurfaceGraph(protocolMessages)) {
    return []
  }

  return serializeSafeA2UIMessages(protocolMessages, policy)
}
