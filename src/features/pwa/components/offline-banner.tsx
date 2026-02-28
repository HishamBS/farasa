'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { CloudOff } from 'lucide-react'
import { fadeInDown } from '@/lib/utils/motion'
import { UI_TEXT } from '@/config/constants'
import { ROUTES } from '@/config/routes'

export function OfflineBanner() {
  const shouldReduce = useReducedMotion()
  const pathname = usePathname()
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
      {isOffline && !pathname.startsWith(ROUTES.CHAT) && (
        <motion.div
          role="status"
          aria-live="assertive"
          className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-[--warning] px-4 py-2 text-sm font-medium text-black"
          {...(shouldReduce ? {} : fadeInDown)}
        >
          <CloudOff className="size-4" />
          <span>{UI_TEXT.OFFLINE_BANNER}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
