export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  CHAT: '/chat',
  CHAT_BY_ID: (id: string) => `/chat/${id}` as const,
  API: {
    TRPC: '/api/trpc',
    AUTH: '/api/auth',
    HEALTH: '/api/health',
  },
} as const

export const PATTERNS = {
  CHAT_ID:
    /^\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
} as const
