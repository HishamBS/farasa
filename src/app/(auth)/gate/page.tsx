'use client'

import { useActionState } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp, scaleIn } from '@/lib/utils/motion'
import appIcon from '@/app/icon.png'
import { verifyAccessCode } from './actions'

export default function GatePage() {
  const shouldReduce = useReducedMotion()
  const [state, formAction, isPending] = useActionState(verifyAccessCode, null)

  return (
    <div className="relative z-10 w-full max-w-sm px-4">
      <motion.div
        className="rounded-2xl border border-(--border-default) bg-(--bg-shell) p-8 shadow-2xl shadow-black/30 backdrop-blur-2xl"
        {...(shouldReduce ? {} : fadeInUp)}
      >
        <motion.div
          className="mb-8 flex flex-col items-center gap-2"
          {...(shouldReduce ? {} : scaleIn)}
        >
          <Image
            src={appIcon}
            alt="farasa"
            width={40}
            height={40}
            className="mb-1 rounded-xl"
            priority
          />

          <h1 className="text-2xl font-semibold tracking-tight text-(--text-primary)">farasa</h1>
          <p className="text-sm text-(--text-muted)">Your intelligent AI workspace</p>
        </motion.div>

        <form action={formAction} className="flex flex-col gap-4">
          <input
            type="password"
            name="code"
            placeholder="Enter access code"
            autoComplete="off"
            required
            className="min-h-11 w-full rounded-xl border border-(--border-default) bg-(--bg-surface) px-4 py-3 text-sm text-(--text-primary) placeholder:text-(--text-ghost) transition-colors focus:border-(--accent-glow) focus:outline-none"
          />

          <button
            type="submit"
            disabled={isPending}
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-(--border-default) bg-(--bg-surface) px-4 py-3 text-sm font-medium text-(--text-primary) transition-colors hover:border-(--accent-glow) hover:bg-(--bg-surface-hover) disabled:opacity-50"
          >
            {isPending ? 'Verifying...' : 'Continue'}
          </button>

          {state?.error && <p className="text-center text-sm text-red-400">{state.error}</p>}
        </form>

        <p className="mt-6 text-center text-xs text-(--text-ghost)">
          Private preview. Contact the team for access.
        </p>
      </motion.div>
    </div>
  )
}
