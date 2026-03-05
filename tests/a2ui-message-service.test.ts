import { describe, expect, it } from 'bun:test'
import { parseA2UIFencePayloadToJsonLines } from '@/server/services/a2ui-message-service'
import type { RuntimeA2UIPolicy } from '@/schemas/runtime-config'

const policy: RuntimeA2UIPolicy = {
  image: {
    allowedProtocols: ['https', 'data', 'relative'],
    allowedHosts: [],
  },
  action: {
    pattern: '^[a-zA-Z0-9_.:\\-/]+$',
  },
}

describe('parseA2UIFencePayloadToJsonLines', () => {
  it('accepts valid surface graph payloads', () => {
    const payload = `
{"beginRendering":{"surfaceId":"surface_main","root":"root"}}
{"surfaceUpdate":{"surfaceId":"surface_main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title"]}}}},{"id":"title","component":{"Text":{"text":{"literalString":"Hello"},"usageHint":"headline"}}}]}}
`

    const lines = parseA2UIFencePayloadToJsonLines(payload, policy)
    expect(lines.length).toBe(2)
  })

  it('rejects payloads where beginRendering root id is missing from components', () => {
    const payload = `
{"beginRendering":{"surfaceId":"surface_main","root":"root"}}
{"surfaceUpdate":{"surfaceId":"surface_main","components":[{"id":"title","component":{"Text":{"text":{"literalString":"Hello"},"usageHint":"headline"}}}]}}
`

    const lines = parseA2UIFencePayloadToJsonLines(payload, policy)
    expect(lines.length).toBe(0)
  })

  it('rejects payloads where children reference missing component ids', () => {
    const payload = `
{"beginRendering":{"surfaceId":"surface_main","root":"root"}}
{"surfaceUpdate":{"surfaceId":"surface_main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["missing_child"]}}}}]}}
`

    const lines = parseA2UIFencePayloadToJsonLines(payload, policy)
    expect(lines.length).toBe(0)
  })
})
