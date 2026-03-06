import { describe, expect, it } from 'bun:test'
import { parseA2UIFencePayloadToJsonLines } from '@/server/services/a2ui-message-service'

describe('parseA2UIFencePayloadToJsonLines', () => {
  it('extracts protocol messages from single-line JSONL', () => {
    const payload = `
{"beginRendering":{"surfaceId":"surface_main","root":"root"}}
{"surfaceUpdate":{"surfaceId":"surface_main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title"]}}}},{"id":"title","component":{"Text":{"text":{"literalString":"Hello"},"usageHint":"headline"}}}]}}
`
    const lines = parseA2UIFencePayloadToJsonLines(payload)
    expect(lines.length).toBe(2)
  })

  it('extracts protocol messages from multi-line pretty-printed JSON', () => {
    const payload = `
{"beginRendering":{"surfaceId":"surface_main","root":"root"}}
{"surfaceUpdate":{"surfaceId":"surface_main","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["title"]}}}},
  {"id":"title","component":{"Text":{"text":{"literalString":"Hello"}}}}
]}}
`
    const lines = parseA2UIFencePayloadToJsonLines(payload)
    expect(lines.length).toBe(2)
  })

  it('passes through payloads with mismatched root ids (SDK handles validation)', () => {
    const payload = `
{"beginRendering":{"surfaceId":"surface_main","root":"root"}}
{"surfaceUpdate":{"surfaceId":"surface_main","components":[{"id":"title","component":{"Text":{"text":{"literalString":"Hello"}}}}]}}
`
    const lines = parseA2UIFencePayloadToJsonLines(payload)
    expect(lines.length).toBe(2)
  })

  it('filters out non-protocol JSON objects', () => {
    const payload = `
{"beginRendering":{"surfaceId":"surface_main","root":"root"}}
{"someRandomKey":"not a protocol message"}
{"surfaceUpdate":{"surfaceId":"surface_main","components":[]}}
`
    const lines = parseA2UIFencePayloadToJsonLines(payload)
    expect(lines.length).toBe(2)
  })

  it('returns empty array for empty payload', () => {
    expect(parseA2UIFencePayloadToJsonLines('')).toEqual([])
    expect(parseA2UIFencePayloadToJsonLines('   ')).toEqual([])
  })

  it('handles markdown mixed with JSONL inside fence', () => {
    const payload = `
Here is the form:
{"beginRendering":{"surfaceId":"surface_main","root":"root"}}
Some explanation text
{"surfaceUpdate":{"surfaceId":"surface_main","components":[]}}
`
    const lines = parseA2UIFencePayloadToJsonLines(payload)
    expect(lines.length).toBe(2)
  })
})
