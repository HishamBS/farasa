import { sanitizeA2UIJsonLine } from '@/lib/security/runtime-safety'
import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'
import type { v0_8 } from '@a2ui-sdk/types'

type UiNode = {
  type: string
  id?: string
  text?: string
  label?: string
  variant?: string
  action?: string
  name?: string
  src?: string
  url?: string
  code?: string
  language?: string
  axis?: 'horizontal' | 'vertical'
  child?: unknown
  children?: unknown
  items?: unknown
}

const PROTOCOL_KEYS = [
  'beginRendering',
  'surfaceUpdate',
  'dataModelUpdate',
  'deleteSurface',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isUiNode(value: unknown): value is UiNode {
  return isRecord(value) && typeof value.type === 'string'
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
            parsed.push(JSON.parse(slice))
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

function normalizeIdentifier(source: string, fallback: string): string {
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized.length > 0 ? normalized : fallback
}

function literalString(value: string): v0_8.ValueSource {
  return { literalString: value }
}

function buildProtocolMessagesFromNodes(nodes: UiNode[]): v0_8.A2UIMessage[] {
  const components: v0_8.ComponentDefinition[] = []
  const usedIds = new Set<string>()
  let generatedCount = 0

  const nextId = (prefix: string): string => {
    generatedCount += 1
    return `${prefix}_${generatedCount}`
  }

  const reserveId = (preferredId: string | undefined, prefix: string): string => {
    const fallback = nextId(prefix)
    const candidate = preferredId ? normalizeIdentifier(preferredId, fallback) : fallback
    if (!usedIds.has(candidate)) {
      usedIds.add(candidate)
      return candidate
    }
    let suffix = 2
    while (usedIds.has(`${candidate}_${suffix}`)) {
      suffix += 1
    }
    const finalId = `${candidate}_${suffix}`
    usedIds.add(finalId)
    return finalId
  }

  const addComponent = (
    componentType: string,
    props: v0_8.ComponentProps,
    preferredId?: string,
  ): string => {
    const id = reserveId(preferredId, componentType.toLowerCase())
    const definition: v0_8.ComponentDefinition = {
      id,
      component: {
        [componentType]: props,
      },
    }
    components.push(definition)
    return id
  }

  const parseChildren = (value: unknown): UiNode[] => {
    if (Array.isArray(value)) {
      return value.filter(isUiNode)
    }
    if (isUiNode(value)) {
      return [value]
    }
    return []
  }

  const mapNode = (node: UiNode): string => {
    const type = node.type.trim().toLowerCase()

    if (type === 'text') {
      const text = node.text ?? node.label ?? ''
      const usageHint =
        node.variant === 'heading' ? 'h3' : node.variant === 'caption' ? 'caption' : 'body'
      return addComponent('Text', { text: literalString(text), usageHint }, node.id)
    }

    if (type === 'textfield' || type === 'input') {
      const label = node.label ?? node.text ?? 'Input'
      const fieldName = normalizeIdentifier(node.name ?? label, 'field')
      return addComponent(
        'TextField',
        {
          label: literalString(label),
          text: { path: `/form/${fieldName}` },
          textFieldType: 'shortText',
        },
        node.id,
      )
    }

    if (type === 'button') {
      const label = node.label ?? node.text ?? 'Submit'
      const labelId = addComponent(
        'Text',
        { text: literalString(label), usageHint: 'body' },
        `${node.id ?? 'button'}_label`,
      )
      const actionName = normalizeIdentifier(node.action ?? label, 'submit')
      return addComponent(
        'Button',
        {
          child: labelId,
          primary: node.variant === 'primary',
          action: { name: actionName },
        },
        node.id,
      )
    }

    if (type === 'image') {
      const source = node.src ?? node.url ?? ''
      return addComponent('Image', { url: literalString(source) }, node.id)
    }

    if (type === 'divider') {
      return addComponent(
        'Divider',
        { axis: node.axis === 'vertical' ? 'vertical' : 'horizontal' },
        node.id,
      )
    }

    if (type === 'codeblock') {
      return addComponent(
        'CodeBlock',
        { code: node.code ?? node.text ?? '', language: node.language ?? 'text' },
        node.id,
      )
    }

    if (type === 'list') {
      const directChildren = parseChildren(node.children)
      const itemTexts = Array.isArray(node.items)
        ? node.items.filter((item): item is string => typeof item === 'string')
        : []
      const childIds = directChildren.map(mapNode)
      for (const itemText of itemTexts) {
        const itemId = addComponent(
          'Text',
          { text: literalString(itemText), usageHint: 'body' },
          `${node.id ?? 'list'}_item`,
        )
        childIds.push(itemId)
      }
      return addComponent(
        'List',
        {
          children: { explicitList: childIds },
          direction: 'vertical',
          alignment: 'start',
        },
        node.id,
      )
    }

    if (type === 'row' || type === 'column') {
      const children = parseChildren(node.children)
      const childIds = children.map(mapNode)
      return addComponent(
        type === 'row' ? 'Row' : 'Column',
        {
          children: { explicitList: childIds },
          alignment: type === 'row' ? 'center' : 'start',
        },
        node.id,
      )
    }

    if (type === 'card') {
      const childNodes = [...parseChildren(node.children), ...parseChildren(node.child)]
      const childIds = childNodes.map(mapNode)
      let cardChildId = childIds[0]
      if (childIds.length > 1) {
        cardChildId = addComponent(
          'Column',
          { children: { explicitList: childIds }, alignment: 'start' },
          `${node.id ?? 'card'}_body`,
        )
      }
      if (!cardChildId) {
        cardChildId = addComponent(
          'Text',
          { text: literalString('Card content'), usageHint: 'body' },
          `${node.id ?? 'card'}_text`,
        )
      }
      return addComponent('Card', { child: cardChildId }, node.id)
    }

    return addComponent(
      'Text',
      { text: literalString(node.text ?? node.label ?? ''), usageHint: 'body' },
      node.id,
    )
  }

  const rootIds = nodes.map(mapNode).filter((id) => id.length > 0)
  if (rootIds.length === 0 || components.length === 0) {
    return []
  }

  const firstRootId = rootIds[0]
  if (!firstRootId) {
    return []
  }
  const rootId =
    rootIds.length === 1
      ? firstRootId
      : addComponent('Column', { children: { explicitList: rootIds }, alignment: 'start' }, 'root')
  const surfaceId = reserveId('surface_main', 'surface')

  return [
    { beginRendering: { surfaceId, root: rootId } },
    { surfaceUpdate: { surfaceId, components } },
  ]
}

function collectUiNodes(candidates: unknown[]): UiNode[] {
  const nodes: UiNode[] = []
  for (const candidate of candidates) {
    if (isUiNode(candidate)) {
      nodes.push(candidate)
      continue
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (isUiNode(item)) {
          nodes.push(item)
        }
      }
      continue
    }
    if (isRecord(candidate) && Array.isArray(candidate.components)) {
      for (const item of candidate.components) {
        if (isUiNode(item)) {
          nodes.push(item)
        }
      }
    }
  }
  return nodes
}

function serializeSafeA2UIMessages(
  messages: v0_8.A2UIMessage[],
  policy: RuntimeA2UIPolicy,
): string[] {
  const lines: string[] = []
  for (const message of messages) {
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
  if (protocolMessages.length > 0) {
    return serializeSafeA2UIMessages(protocolMessages, policy)
  }

  const uiNodes = collectUiNodes(parsed)
  if (uiNodes.length === 0) {
    return []
  }

  const protocolFromNodes = buildProtocolMessagesFromNodes(uiNodes)
  return serializeSafeA2UIMessages(protocolFromNodes, policy)
}
