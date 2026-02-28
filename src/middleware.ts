import NextAuth from 'next-auth'
import { edgeAuthConfig } from '@/lib/auth/edge-config'
import { ROUTES } from '@/config/routes'
import { AppError } from '@/lib/utils/errors'

const { auth } = NextAuth(edgeAuthConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const isProtected = pathname.startsWith(ROUTES.CHAT)
  const isAuthPage = pathname.startsWith(ROUTES.LOGIN)
  const isTrpcApi = pathname.startsWith(ROUTES.API.TRPC)

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL(ROUTES.LOGIN, req.nextUrl))
  }

  if (isTrpcApi && !isLoggedIn) {
    return new Response(JSON.stringify({ error: { message: AppError.UNAUTHORIZED } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL(ROUTES.CHAT, req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
