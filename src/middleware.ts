import NextAuth from 'next-auth'
import { edgeAuthConfig } from '@/lib/auth/edge-config'
import { ROUTES } from '@/config/routes'

const { auth } = NextAuth(edgeAuthConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl

  const accessCode = process.env.ACCESS_CODE
  if (accessCode) {
    const isGatePage = pathname === ROUTES.GATE
    const hasAccess = req.cookies.get('farasa_gate')?.value === accessCode
    if (!hasAccess && !isGatePage) {
      return Response.redirect(new URL(ROUTES.GATE, req.nextUrl))
    }
  }

  const isLoggedIn = !!req.auth
  const isProtected = pathname.startsWith(ROUTES.CHAT)
  const isAuthPage = pathname.startsWith(ROUTES.LOGIN)

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL(ROUTES.LOGIN, req.nextUrl))
  }

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL(ROUTES.CHAT, req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
