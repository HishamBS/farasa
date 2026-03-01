'use client'

import { useEffect } from 'react'

export function DevServiceWorkerReset() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('caches' in window)) return

    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .then(() => caches.keys())
      .then((keys) => {
        const pwaKeys = keys.filter(
          (key) =>
            key.includes('serwist') ||
            key.includes('workbox') ||
            key.includes('precache') ||
            key.includes('runtime'),
        )
        return Promise.all(pwaKeys.map((key) => caches.delete(key)))
      })
      .catch(() => {
        // Non-fatal in development cleanup path.
      })
  }, [])

  return null
}
