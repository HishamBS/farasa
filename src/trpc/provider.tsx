'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCReact } from '@trpc/react-query'
import { splitLink, httpBatchLink, httpSubscriptionLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '@/server/routers/_app'
import { ROUTES } from '@/config/routes'
import { UX } from '@/config/constants'
import { getBaseUrl } from '@/trpc/client'
import { isTrpcUnauthorizedError } from '@/lib/utils/trpc-errors'

export const trpc = createTRPCReact<AppRouter>()

let isRedirectingToLogin = false

function handleUnauthorized(error: unknown): void {
  if (!isTrpcUnauthorizedError(error) || typeof window === 'undefined') return
  if (window.location.pathname === ROUTES.LOGIN || isRedirectingToLogin) return
  isRedirectingToLogin = true
  window.location.replace(ROUTES.LOGIN)
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        handleUnauthorized(error)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        handleUnauthorized(error)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: UX.QUERY_STALE_TIME_MS,
        gcTime: UX.QUERY_GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  })
}

// Module-level singleton avoids re-creating the QueryClient on every render in
// the browser. On the server a fresh client is created per request (no singleton).
let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  const [trpcClientInstance] = useState(() =>
    trpc.createClient({
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
    }),
  )

  return (
    <trpc.Provider client={trpcClientInstance} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
