'use client'

import { motion } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'

export default function OfflinePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-[--bg-root] px-4 text-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[--thinking]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[--accent]/10 blur-3xl" />
      </div>

      <motion.div
        {...fadeInUp}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-[--border-default] bg-[--bg-shell] p-8 shadow-2xl shadow-black/30 backdrop-blur-2xl"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[--bg-surface] text-[--text-muted]">
          <WifiOff className="size-7" />
        </div>
        <h1 className="text-xl font-semibold text-[--text-primary]">You&apos;re offline</h1>
        <p className="text-sm text-[--text-muted]">Check your internet connection and try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-[--border-default] bg-[--bg-surface] px-4 py-2 text-sm text-[--text-secondary] transition-colors hover:bg-[--bg-surface-hover]"
        >
          Try again
        </button>
      </motion.div>
    </div>
  )
}
