'use client'

import { useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { fadeInUp, scaleIn, staggerContainer } from '@/lib/utils/motion'
import { useReducedMotion } from 'framer-motion'
import { ROUTES } from '@/config/routes'

export default function LoginPage() {
  const shouldReduce = useReducedMotion()

  const handleGoogleSignIn = useCallback(() => {
    void signIn('google', { callbackUrl: ROUTES.CHAT })
  }, [])

  return (
    <div className="relative w-full max-w-sm px-4">
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-[--accent-muted] via-transparent to-[--thinking-bg]"
          animate={shouldReduce ? {} : { opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="relative rounded-2xl border border-[--border-default] bg-[--bg-glass] p-8 backdrop-blur-xl shadow-2xl"
        {...(shouldReduce ? {} : fadeInUp)}
      >
        <motion.div
          className="mb-8 flex flex-col items-center gap-2"
          {...(shouldReduce ? {} : staggerContainer)}
        >
          <motion.div {...(shouldReduce ? {} : scaleIn)}>
            <div className="mb-1 size-10 rounded-xl bg-[--accent-muted] flex items-center justify-center">
              <span className="text-lg font-bold text-[--accent]">f</span>
            </div>
          </motion.div>

          <motion.h1
            className="text-2xl font-semibold tracking-tight text-[--text-primary]"
            {...(shouldReduce ? {} : fadeInUp)}
          >
            farasa
          </motion.h1>

          <motion.p
            className="text-sm text-[--text-muted] text-center"
            {...(shouldReduce ? {} : fadeInUp)}
          >
            Your intelligent AI assistant
          </motion.p>
        </motion.div>

        <motion.button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[--border-default] bg-[--bg-surface] px-4 py-3 text-sm font-medium text-[--text-primary] transition-colors hover:border-[--accent] hover:bg-[--bg-surface-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] min-h-11"
          {...(shouldReduce ? {} : fadeInUp)}
          whileHover={shouldReduce ? {} : { scale: 1.01 }}
          whileTap={shouldReduce ? {} : { scale: 0.99 }}
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </motion.button>

        <motion.p
          className="mt-6 text-center text-xs text-[--text-ghost]"
          {...(shouldReduce ? {} : fadeInUp)}
        >
          By continuing, you agree to our terms of service
        </motion.p>
      </motion.div>
    </div>
  )
}
