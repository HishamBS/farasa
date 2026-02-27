'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp } from '@/lib/utils/motion'

type UserMessageProps = {
  content: string
}

export function UserMessage({ content }: UserMessageProps) {
  const shouldReduce = useReducedMotion()

  return (
    <motion.div
      className="flex justify-end"
      {...(shouldReduce ? {} : fadeInUp)}
    >
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[--bg-user-message] px-4 py-3 lg:max-w-[72%]">
        <p className="text-sm leading-relaxed text-[--text-primary] whitespace-pre-wrap">
          {content}
        </p>
      </div>
    </motion.div>
  )
}
