import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'

const DATA_URL_PREFIX = 'data:'
const DATA_URL_SEPARATOR = ','

function extractBase64Buffer(dataUrl: string): Buffer {
  const commaIndex = dataUrl.indexOf(DATA_URL_SEPARATOR)
  if (commaIndex === -1) return Buffer.alloc(0)
  return Buffer.from(dataUrl.slice(commaIndex + 1), 'base64')
}

function isDataUrl(url: string): boolean {
  return url.startsWith(DATA_URL_PREFIX)
}

async function extractRawText(fileType: string, storageUrl: string): Promise<string> {
  if (fileType.startsWith('text/') || fileType === 'application/json') {
    if (!isDataUrl(storageUrl)) return ''
    return extractBase64Buffer(storageUrl).toString('utf-8')
  }

  if (fileType === 'application/pdf') {
    if (!isDataUrl(storageUrl)) return ''
    const buffer = extractBase64Buffer(storageUrl)
    if (buffer.length === 0) return ''
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    await parser.destroy()
    return result.text
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
