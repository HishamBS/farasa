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
