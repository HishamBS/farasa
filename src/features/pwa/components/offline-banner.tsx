'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { CloudOff } from 'lucide-react'
import { fadeInDown } from '@/lib/utils/motion'

export function OfflineBanner() {
  const shouldReduce = useReducedMotion()
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          role="status"
          aria-live="assertive"
          className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-[--warning] px-4 py-2 text-sm font-medium text-black"
          {...(shouldReduce ? {} : fadeInDown)}
        >
          <CloudOff className="size-4" />
          <span>You&apos;re offline — your conversations will be here when you&apos;re back</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
