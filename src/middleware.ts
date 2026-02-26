import { auth } from '@/lib/auth/config'
import { ROUTES } from '@/config/routes'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const isProtected = pathname.startsWith('/chat')
  const isAuthPage = pathname.startsWith('/login')

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL(ROUTES.LOGIN, req.nextUrl))
  }

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL(ROUTES.CHAT, req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
