import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

import { appRouter } from '@/server/routers/_app'
import { auth } from '@/lib/auth/config'
import { createContextFromSession } from '@/server/context'
import { ROUTES } from '@/config/routes'

const authHandler = auth((req) =>
  fetchRequestHandler({
    endpoint: ROUTES.API.TRPC,
    req,
    router: appRouter,
    createContext: () => createContextFromSession(req.auth ?? null),
    onError:
      process.env['NODE_ENV'] === 'development'
        ? ({ path, error }) => {
            console.error(`tRPC error on ${path ?? '<no-path>'}:`, error)
          }
        : undefined,
  }),
)

type TrpcRouteContext = { params: Promise<{ trpc: string }> }

export async function GET(req: NextRequest, context: TrpcRouteContext) {
  return authHandler(req, { params: await context.params })
}

export async function POST(req: NextRequest, context: TrpcRouteContext) {
  return authHandler(req, { params: await context.params })
}
