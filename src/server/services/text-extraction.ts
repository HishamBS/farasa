import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'

const DATA_URL_PREFIX = 'data:'
const DATA_URL_SEPARATOR = ','

const TEXT_LIKE_APPLICATION_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/typescript',
  'application/x-yaml',
  'application/x-sh',
  'application/sql',
  'application/graphql',
  'application/toml',
])

function extractBase64Buffer(dataUrl: string): Buffer {
  const commaIndex = dataUrl.indexOf(DATA_URL_SEPARATOR)
  if (commaIndex === -1) return Buffer.alloc(0)
  return Buffer.from(dataUrl.slice(commaIndex + 1), 'base64')
}

function isDataUrl(url: string): boolean {
  return url.startsWith(DATA_URL_PREFIX)
}

async function fetchRemoteBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function resolveBuffer(storageUrl: string): Promise<Buffer> {
  if (isDataUrl(storageUrl)) return extractBase64Buffer(storageUrl)
  return fetchRemoteBuffer(storageUrl)
}

function isTextLike(fileType: string): boolean {
  return fileType.startsWith('text/') || TEXT_LIKE_APPLICATION_TYPES.has(fileType)
}

async function extractRawText(fileType: string, storageUrl: string): Promise<string> {
  if (isTextLike(fileType)) {
    const buffer = await resolveBuffer(storageUrl)
    if (buffer.length === 0) return ''
    return buffer.toString('utf-8')
  }

  if (fileType === 'application/pdf') {
    const buffer = await resolveBuffer(storageUrl)
    if (buffer.length === 0) return ''
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const result = await parser.getText()
      await parser.destroy()
      return result.text
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error('[text-extraction] PDF parsing failed:', detail)
      throw new Error(`PDF extraction failed: ${detail}`)
    }
  }

  return ''
}

export async function extractFileContentBlock(
  fileName: string,
  fileType: string,
  storageUrl: string,
): Promise<string> {
  const text = await extractRawText(fileType, storageUrl)
  if (!text) return ''
  return `<file name="${escapeXmlForPrompt(fileName)}">\n${text}\n</file>`
}
