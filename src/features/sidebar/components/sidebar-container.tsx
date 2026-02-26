'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { slideInLeft } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { MOTION } from '@/config/constants'
import type { SidebarProps } from '@/types/layout'

export function SidebarContainer({ children, isOpen, onClose }: SidebarProps) {
  const shouldReduce = useReducedMotion()

  const handleBackdropClick = useCallback(() => onClose(), [onClose])

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={shouldReduce ? {} : { opacity: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={shouldReduce ? {} : { duration: MOTION.DURATION_NORMAL }}
            onClick={handleBackdropClick}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col',
          'bg-[--bg-glass] backdrop-blur-xl border-r border-[--border-subtle]',
          'transition-transform duration-300',
          'lg:relative lg:translate-x-0 lg:transition-none',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Sidebar"
      >
        <motion.div
          className="flex h-full flex-col"
          {...(shouldReduce ? {} : slideInLeft)}
        >
          {children}
        </motion.div>
      </aside>
    </>
  )
}
