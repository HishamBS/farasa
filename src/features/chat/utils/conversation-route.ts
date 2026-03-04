import { ROUTES } from '@/config/routes'

type RouteSyncInput = {
  currentPathname: string
  pendingConversationId: string | undefined
}

export function shouldReplaceConversationRoute({
  currentPathname,
  pendingConversationId,
}: RouteSyncInput): boolean {
  if (!pendingConversationId) return false
  return currentPathname !== ROUTES.CHAT_BY_ID(pendingConversationId)
}
