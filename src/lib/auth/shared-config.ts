import { env } from '@/config/env'
import { ROUTES } from '@/config/routes'
import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

export const authSharedConfig = {
  trustHost: true,
  secret: env.AUTH_SECRET,
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: ROUTES.LOGIN,
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.name = user.name
        token.email = user.email
        token.picture = user.image
      }
      return token
    },
    session({ session, token }) {
      if (!token.sub) {
        console.error('[auth] JWT token missing sub claim')
        session.user.id = ''
        return session
      }
      session.user.id = token.sub
      session.user.name = typeof token.name === 'string' ? token.name : ''
      session.user.email = typeof token.email === 'string' ? token.email : ''
      session.user.image = typeof token.picture === 'string' ? token.picture : ''
      return session
    },
  },
} satisfies NextAuthConfig
