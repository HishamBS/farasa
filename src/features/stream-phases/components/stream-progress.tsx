'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { CHAT_STREAM_STATUS } from '@/config/constants'
import { fadeInUp } from '@/lib/utils/motion'
import type { StreamState } from '@/types/stream'

type StreamProgressProps = {
  streamState: StreamState
}

export function StreamProgress({ streamState }: StreamProgressProps) {
  const shouldReduce = useReducedMotion()

  if (streamState.phase === CHAT_STREAM_STATUS.ERROR && streamState.error) {
    return (
      <motion.div
        {...(shouldReduce ? {} : fadeInUp)}
        className="mx-auto my-3 flex max-w-(--content-max-width) items-center gap-2 rounded-lg border border-(--error)/20 bg-(--error)/5 px-3 py-2 text-sm text-(--error)"
      >
        <AlertCircle className="size-4 shrink-0" />
        <span className="flex-1">{streamState.error.message}</span>
      </motion.div>
    )
  }

  return null
}
