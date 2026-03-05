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
    onMutate: async (variables) => {
      await utils.conversation.getById.cancel({ id: variables.id })
      await utils.conversation.list.cancel()
      const prevById = utils.conversation.getById.getData({ id: variables.id })
      utils.conversation.getById.setData({ id: variables.id }, (old) =>
        old ? { ...old, ...variables } : old,
      )
      utils.conversation.list.setInfiniteData({}, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((c) => (c.id === variables.id ? { ...c, ...variables } : c)),
          })),
        }
      })
      return { prevById, id: variables.id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevById) utils.conversation.getById.setData({ id: ctx.id }, ctx.prevById)
    },
    onSettled: () => void utils.conversation.invalidate(),
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
