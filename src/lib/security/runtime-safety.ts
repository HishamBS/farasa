import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isRelativeUrl(value: string): boolean {
  return value.startsWith('/') || value.startsWith('./') || value.startsWith('../')
}

function isHostAllowed(hostname: string, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) return true
  return allowedHosts.some((host) => host === hostname || hostname.endsWith(`.${host}`))
}

export function escapeXmlForPrompt(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function isAllowedA2UIImageUrl(url: string, policy: RuntimeA2UIPolicy['image']): boolean {
  if (isRelativeUrl(url)) {
    return policy.allowedProtocols.includes('relative')
  }
  if (url.startsWith('data:')) {
    return policy.allowedProtocols.includes('data')
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') {
    return false
  }
  if (!policy.allowedProtocols.includes('https')) {
    return false
  }
  return isHostAllowed(parsed.hostname, policy.allowedHosts)
}

export function isAllowedA2UIButtonAction(action: unknown, pattern: string): boolean {
  let candidate: string | null = null
  if (typeof action === 'string') {
    candidate = action
  } else if (isRecord(action)) {
    const name = action.name ?? action.type ?? action.label ?? action.id
    if (typeof name === 'string') {
      candidate = name
    }
  }
  if (!candidate) return true

  let regex: RegExp
  try {
    regex = new RegExp(pattern)
  } catch {
    return false
  }

  const REGEX_TEST_TIMEOUT_MS = 50
  const start = performance.now()
  const result = regex.test(candidate)
  if (performance.now() - start > REGEX_TEST_TIMEOUT_MS) {
    console.error(
      '[runtime-safety] Regex test exceeded time threshold, pattern may be vulnerable to ReDoS',
    )
    return false
  }
  return result
}

function validateA2UIPayloadNode(
  value: unknown,
  policy: RuntimeA2UIPolicy,
  visited: WeakSet<object>,
): boolean {
  if (!isRecord(value) && !Array.isArray(value)) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every((item) => validateA2UIPayloadNode(item, policy, visited))
  }

  if (visited.has(value)) {
    return true
  }
  visited.add(value)

  const type = typeof value.type === 'string' ? value.type : null
  if (type === 'Image') {
    const source =
      typeof value.src === 'string' ? value.src : typeof value.url === 'string' ? value.url : null
    if (!source || !isAllowedA2UIImageUrl(source, policy.image)) {
      return false
    }
  }
  if (type === 'Button' && 'action' in value) {
    if (!isAllowedA2UIButtonAction(value.action, policy.action.pattern)) {
      return false
    }
  }

  return Object.values(value).every((child) => validateA2UIPayloadNode(child, policy, visited))
}

export function validateA2UIPayload(payload: unknown, policy: RuntimeA2UIPolicy): boolean {
  return validateA2UIPayloadNode(payload, policy, new WeakSet<object>())
}

export function sanitizeA2UIJsonLine(line: string, policy: RuntimeA2UIPolicy): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }

  if (!validateA2UIPayload(parsed, policy)) {
    return null
  }
  return JSON.stringify(parsed)
}
