'use client'

const IMAGE_MARKDOWN_PREFIX = '!['

/**
 * Detects if content consists entirely of markdown image syntax with data URIs or https URLs.
 * Uses string operations instead of regex to avoid backtracking on multi-MB base64 strings.
 */
export function isGeneratedImageContent(content: string): boolean {
  const parts = content.split('\n\n').filter((p) => p.trim().length > 0)
  if (parts.length === 0) return false
  return parts.every((part) => {
    const trimmed = part.trim()
    if (!trimmed.startsWith(IMAGE_MARKDOWN_PREFIX)) return false
    const srcStart = trimmed.indexOf('](')
    if (srcStart === -1) return false
    if (!trimmed.endsWith(')')) return false
    const src = trimmed.slice(srcStart + 2, trimmed.length - 1)
    return src.startsWith('data:image/') || src.startsWith('https://')
  })
}

function extractImages(content: string): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = []
  const parts = content.split('\n\n').filter((p) => p.trim().length > 0)
  for (const part of parts) {
    const trimmed = part.trim()
    const altEnd = trimmed.indexOf('](')
    if (altEnd === -1) continue
    const alt = trimmed.slice(2, altEnd) || 'Generated image'
    const src = trimmed.slice(altEnd + 2, trimmed.length - 1)
    if (src.startsWith('data:image/') || src.startsWith('https://')) {
      images.push({ src, alt })
    }
  }
  return images
}

export function GeneratedImage({ content }: { content: string }) {
  const images = extractImages(content)

  return (
    <div className="space-y-3">
      {images.map((image, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic base64/external URLs from AI image gen models
        <img
          key={i}
          src={image.src}
          alt={image.alt}
          className="my-3 max-w-full rounded-xl"
          loading="lazy"
        />
      ))}
    </div>
  )
}
