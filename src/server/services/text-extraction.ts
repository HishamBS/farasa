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

function validateRemoteUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid storage URL')
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL scheme: ${parsed.protocol}`)
  }
  const host = parsed.hostname
  if (
    host === 'localhost' ||
    host === '169.254.169.254' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error('Storage URL points to private network')
  }
}

async function fetchRemoteBuffer(url: string): Promise<Buffer> {
  validateRemoteUrl(url)
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
