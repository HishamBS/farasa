import { auth } from '@/lib/auth/config'
import { ROUTES } from '@/config/routes'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const isProtected = pathname.startsWith(ROUTES.CHAT)
  const isAuthPage = pathname.startsWith(ROUTES.LOGIN)
  const isTrpcApi = pathname.startsWith('/api/trpc')

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL(ROUTES.LOGIN, req.nextUrl))
  }

  if (isTrpcApi && !isLoggedIn) {
    return new Response(
      JSON.stringify({ error: { message: 'Unauthorized' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL(ROUTES.CHAT, req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
