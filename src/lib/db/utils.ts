export function isNeonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.neon.tech')
  } catch {
    return false
  }
}

/**
 * Resolves a user-supplied limit against configured defaults, and returns the
 * fetch-limit used to detect whether a next page exists (N+1 sentinel pattern).
 */
export function resolvePaginationLimit(
  inputLimit: number | undefined,
  defaults: { paginationDefaultLimit: number; paginationMaxLimit: number },
): { resolvedLimit: number; fetchLimit: number } {
  const resolvedLimit = Math.min(
    inputLimit ?? defaults.paginationDefaultLimit,
    defaults.paginationMaxLimit,
  )
  return { resolvedLimit, fetchLimit: resolvedLimit + 1 }
}
