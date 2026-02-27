'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Square } from 'lucide-react'
import { scaleIn } from '@/lib/utils/motion'

type StopButtonProps = {
  onAbort: () => void
}

export function StopButton({ onAbort }: StopButtonProps) {
  const shouldReduce = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onAbort}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[--error] text-[--error] hover:bg-[--error]/10"
      {...(shouldReduce ? {} : scaleIn)}
      aria-label="Stop generating"
    >
      <Square size={14} />
    </motion.button>
  )
}
