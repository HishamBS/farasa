import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

export const dynamic = 'force-dynamic'

import { appRouter } from '@/server/routers/_app'
import { createContextFromRequest } from '@/server/context'
import { ROUTES } from '@/config/routes'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: ROUTES.API.TRPC,
    req,
    router: appRouter,
    createContext: () => createContextFromRequest(req),
    onError:
      process.env['NODE_ENV'] === 'development'
        ? ({ path, error }) => {
            console.error(`tRPC error on ${path ?? '<no-path>'}:`, error)
          }
        : undefined,
  })

export { handler as GET, handler as POST }
