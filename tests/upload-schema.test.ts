import { describe, expect, it } from 'bun:test'
import { StoreInlineSchema } from '@/schemas/upload'

describe('StoreInlineSchema', () => {
  it('rejects non-data-URL strings', () => {
    expect(
      StoreInlineSchema.safeParse({
        dataUrl: 'https://example.com/image.png',
        fileName: 'test.png',
        fileType: 'image/png',
      }).success,
    ).toBe(false)
  })

  it('rejects plain text', () => {
    expect(
      StoreInlineSchema.safeParse({
        dataUrl: 'not-a-data-url',
        fileName: 'test.png',
        fileType: 'image/png',
      }).success,
    ).toBe(false)
  })

  it('accepts valid base64 data URLs', () => {
    expect(
      StoreInlineSchema.safeParse({
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        fileName: 'test.png',
        fileType: 'image/png',
      }).success,
    ).toBe(true)
  })

  it('accepts valid data URLs with complex MIME types', () => {
    expect(
      StoreInlineSchema.safeParse({
        dataUrl: 'data:application/pdf;base64,JVBERi0=',
        fileName: 'doc.pdf',
        fileType: 'application/pdf',
      }).success,
    ).toBe(true)
  })

  it('rejects data: prefix with no MIME type', () => {
    expect(
      StoreInlineSchema.safeParse({
        dataUrl: 'data:',
        fileName: 'test.png',
        fileType: 'image/png',
      }).success,
    ).toBe(false)
  })

  it('rejects base64 payload with invalid characters', () => {
    expect(
      StoreInlineSchema.safeParse({
        dataUrl: 'data:image/png;base64,@@@invalid@@@',
        fileName: 'test.png',
        fileType: 'image/png',
      }).success,
    ).toBe(false)
  })

  it('rejects base64 payload with spaces', () => {
    expect(
      StoreInlineSchema.safeParse({
        dataUrl: 'data:image/png;base64, abc=',
        fileName: 'test.png',
        fileType: 'image/png',
      }).success,
    ).toBe(false)
  })
})
