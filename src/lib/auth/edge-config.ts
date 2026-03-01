import type { NextAuthConfig } from 'next-auth'
import { authSharedConfig } from '@/lib/auth/shared-config'

export const edgeAuthConfig: NextAuthConfig = {
  ...authSharedConfig,
  callbacks: {
    ...authSharedConfig.callbacks,
    authorized({ auth }) {
      return !!auth?.user
    },
  },
}
