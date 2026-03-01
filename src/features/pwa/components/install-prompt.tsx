'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Download } from 'lucide-react'
import { ROUTES } from '@/config/routes'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const pathname = usePathname()
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') {
      setPromptEvent(null)
      return
    }
    setIsDismissed(true)
  }, [promptEvent])

  if (!promptEvent || isDismissed || pathname.startsWith(ROUTES.CHAT)) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        onClick={handleInstall}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-(--border-default) bg-(--bg-glass) px-4 py-2 text-sm text-(--text-primary) backdrop-blur-lg transition-colors hover:bg-(--bg-surface-hover)"
      >
        <Download className="size-4" />
        Install App
      </button>
    </div>
  )
}
