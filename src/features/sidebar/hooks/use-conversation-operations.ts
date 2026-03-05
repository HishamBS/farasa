'use client'

import { ROUTES } from '@/config/routes'
import { trpc } from '@/trpc/provider'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'

type UseConversationOperationsOptions = {
  navigateOnDelete?: boolean
}

export function useConversationOperations({
  navigateOnDelete = false,
}: UseConversationOperationsOptions = {}) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [isExporting, setIsExporting] = useState(false)

  const navigateRef = useRef(navigateOnDelete)
  navigateRef.current = navigateOnDelete

  const updateMutation = trpc.conversation.update.useMutation({
    onSuccess: () => void utils.conversation.invalidate(),
    onError: () => void utils.conversation.invalidate(),
  })

  const deleteMutation = trpc.conversation.delete.useMutation({
    onSuccess: () => {
      void utils.conversation.invalidate()
      if (navigateRef.current) router.push(ROUTES.CHAT)
    },
    onError: () => void utils.conversation.invalidate(),
  })

  const navigate = useCallback((path: string) => router.push(path), [router])

  const handleExport = useCallback(
    async (id: string) => {
      setIsExporting(true)
      try {
        const result = await utils.conversation.exportMarkdown.fetch({ id })
        const blob = new Blob([result.markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${result.title}.md`
        a.click()
        URL.revokeObjectURL(url)
      } catch {
        // Download failure is non-critical; the download simply doesn't appear
      } finally {
        setIsExporting(false)
      }
    },
    [utils],
  )

  return { updateMutation, deleteMutation, isExporting, handleExport, navigate }
}
