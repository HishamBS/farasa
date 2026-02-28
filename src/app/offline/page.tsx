'use client'

import { motion } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[--bg-root] px-4 text-center">
      <motion.div {...fadeInUp} className="flex flex-col items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-[--bg-surface] text-[--text-muted]">
          <WifiOff className="size-8" />
        </div>
        <h1 className="text-xl font-semibold text-[--text-primary]">You&apos;re offline</h1>
        <p className="max-w-sm text-sm text-[--text-muted]">
          Check your internet connection and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-[--bg-surface] px-4 py-2 text-sm text-[--text-secondary] hover:bg-[--bg-surface-hover]"
        >
          Try again
        </button>
      </motion.div>
    </div>
  )
}
