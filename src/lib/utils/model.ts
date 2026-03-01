export function extractModelName(modelId: string): string {
  const parts = modelId.split('/')
  return parts.length > 1 ? (parts.slice(1).join('/') ?? modelId) : modelId
}

export function extractProviderKey(modelId: string): string {
  return modelId.split('/')[0] ?? modelId
}
