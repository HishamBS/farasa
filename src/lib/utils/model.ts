export function extractModelName(modelId: string): string {
  const parts = modelId.split('/')
  return parts.length > 1 ? (parts.slice(1).join('/') ?? modelId) : modelId
}

export function extractProviderKey(modelId: string): string {
  return (modelId.split('/')[0] ?? modelId).trim().toLowerCase()
}

export function resolveProviderKey(modelId: string, aliases: Record<string, string>): string {
  const raw = extractProviderKey(modelId)
  return aliases[raw] ?? raw
}
