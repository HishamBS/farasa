import { describe, expect, it } from 'bun:test'
import { resolvePaginationLimit } from './utils'

const defaults = { paginationDefaultLimit: 20, paginationMaxLimit: 50 }

describe('resolvePaginationLimit', () => {
  it('uses default when inputLimit is undefined', () => {
    const { resolvedLimit, fetchLimit } = resolvePaginationLimit(undefined, defaults)
    expect(resolvedLimit).toBe(20)
    expect(fetchLimit).toBe(21)
  })

  it('clamps to max when inputLimit exceeds max', () => {
    const { resolvedLimit, fetchLimit } = resolvePaginationLimit(100, defaults)
    expect(resolvedLimit).toBe(50)
    expect(fetchLimit).toBe(51)
  })

  it('uses inputLimit when within bounds', () => {
    const { resolvedLimit, fetchLimit } = resolvePaginationLimit(10, defaults)
    expect(resolvedLimit).toBe(10)
    expect(fetchLimit).toBe(11)
  })

  it('uses max when inputLimit equals max', () => {
    const { resolvedLimit, fetchLimit } = resolvePaginationLimit(50, defaults)
    expect(resolvedLimit).toBe(50)
    expect(fetchLimit).toBe(51)
  })
})
