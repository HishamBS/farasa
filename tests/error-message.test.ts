import { describe, expect, it } from 'bun:test'
import { getErrorMessage } from '@/lib/utils/errors'

describe('getErrorMessage', () => {
  it('normalizes non-json parser errors to upload guidance', () => {
    const message = getErrorMessage(
      new Error(`Unexpected token '<', "<html><head"... is not valid JSON`),
    )
    expect(message).toBe('Upload request was rejected. The file may be too large.')
  })

  it('normalizes 413 messages to file-size guidance', () => {
    const message = getErrorMessage(new Error('Request failed with status code 413'))
    expect(message).toBe('File too large. Please upload a smaller file.')
  })

  it('returns internal fallback for unknown non-error values', () => {
    const message = getErrorMessage({ foo: 'bar' })
    expect(message).toBe('Internal server error')
  })
})
