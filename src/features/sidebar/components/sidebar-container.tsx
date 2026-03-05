'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { slideInLeft } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { MOTION, UX } from '@/config/constants'
import type { SidebarProps } from '@/types/layout'

export function SidebarContainer({ children, isOpen, onClose, onOpen }: SidebarProps) {
  const shouldReduce = useReducedMotion()

  const handleBackdropClick = useCallback(() => onClose(), [onClose])

  const handleSwipeDragEnd = useCallback(
    (_event: PointerEvent, info: PanInfo) => {
      if (info.offset.x > UX.SIDEBAR_SWIPE_THRESHOLD && info.velocity.x > 0) {
        onOpen()
      }
    },
    [onOpen],
  )

  return (
    <>
      {!isOpen && (
        <motion.div
          className="fixed left-0 top-0 z-30 h-full w-4 touch-none lg:hidden"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={UX.SIDEBAR_DRAG_ELASTIC}
          onDragEnd={handleSwipeDragEnd}
        />
      )}

      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-(--overlay) backdrop-blur-sm lg:hidden"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={shouldReduce ? {} : { opacity: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={shouldReduce ? {} : { duration: MOTION.DURATION_NORMAL }}
            onClick={handleBackdropClick}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar: fixed flyout */}
      <motion.aside
        initial={false}
        animate={shouldReduce ? {} : { x: isOpen ? 0 : '-100%' }}
        transition={shouldReduce ? {} : { duration: MOTION.DURATION_SLOW, ease: MOTION.EASING }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col lg:hidden',
          'bg-(--bg-glass) border-r border-(--border-subtle) backdrop-blur-xl saturate-150',
          'shadow-(--shadow-elevation-2)',
          isOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-label="Sidebar"
      >
        <motion.div className="flex h-full flex-col" {...(shouldReduce ? {} : slideInLeft)}>
          {children}
        </motion.div>
      </motion.aside>

      {/* Desktop sidebar: static, width-based toggle */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 overflow-hidden',
          'bg-(--bg-glass) border-r border-(--border-subtle) backdrop-blur-xl saturate-150',
          'transition-[width] duration-[var(--sidebar-transition-duration)]',
          isOpen ? 'w-[var(--sidebar-width)] pointer-events-auto' : 'w-0 pointer-events-none',
        )}
        aria-label="Sidebar"
      >
        <div className="flex h-full flex-col w-[var(--sidebar-width)]">{children}</div>
      </aside>
    </>
  )
}
