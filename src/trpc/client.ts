import { createTRPCClient, splitLink, httpBatchLink, httpSubscriptionLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '@/server/routers/_app'
import { ROUTES } from '@/config/routes'
import { APP_CONFIG } from '@/config/constants'

export function getBaseUrl() {
  if (typeof window !== 'undefined') return ''
  return process.env['NEXT_PUBLIC_APP_URL'] ?? APP_CONFIG.DEFAULT_LOCALHOST_URL
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: `${getBaseUrl()}${ROUTES.API.TRPC}`,
        transformer: superjson,
      }),
      false: httpBatchLink({
        url: `${getBaseUrl()}${ROUTES.API.TRPC}`,
        transformer: superjson,
      }),
    }),
  ],
})
