import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { env } from '@/config/env'
import { ROUTES } from '@/config/routes'

export const edgeAuthConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: ROUTES.LOGIN,
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
  },
}
