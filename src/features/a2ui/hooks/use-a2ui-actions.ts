'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/provider'
import { ROUTES } from '@/config/routes'
import type { ActionPayload } from '@a2ui-sdk/types/0.8'

export function useA2UIActions() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const createConversation = trpc.conversation.create.useMutation()
  const updateConversation = trpc.conversation.update.useMutation()
  const deleteConversation = trpc.conversation.delete.useMutation()
  const refreshModels = trpc.model.refresh.useMutation()
  const executeSearch = trpc.search.execute.useMutation()
  const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()

  const handleAction = useCallback(
    (action: ActionPayload) => {
      const name = action.name.toLowerCase()
      switch (name) {
        case 'newchat': {
          void createConversation.mutateAsync({}).then((conv) => {
            void utils.conversation.list.invalidate()
            router.push(ROUTES.CHAT_BY_ID(conv.id))
          })
          return
        }
        case 'rename': {
          const id = String(action.context['id'] ?? '')
          const title = String(action.context['title'] ?? '').trim()
          if (!id || !title) return
          void updateConversation
            .mutateAsync({ id, title })
            .then(() => utils.conversation.list.invalidate())
          return
        }
        case 'pin':
        case 'unpin': {
          const id = String(action.context['id'] ?? '')
          if (!id) return
          void updateConversation
            .mutateAsync({ id, isPinned: name === 'pin' })
            .then(() => utils.conversation.list.invalidate())
          return
        }
        case 'delete': {
          const id = String(action.context['id'] ?? '')
          if (!id) return
          void deleteConversation.mutateAsync({ id }).then(() => {
            void utils.conversation.list.invalidate()
            router.push(ROUTES.CHAT)
          })
          return
        }
        case 'refreshmodels': {
          void refreshModels.mutateAsync({ force: true }).then(() => utils.model.list.invalidate())
          return
        }
        case 'search': {
          const query = String(action.context['query'] ?? '').trim()
          if (!query) return
          const runtimeConfig = runtimeConfigQuery.data
          if (!runtimeConfig) return
          void executeSearch.mutateAsync({
            query,
            includeImages: runtimeConfig.search.includeImagesByDefault,
            maxResults: runtimeConfig.limits.searchMaxResults,
            searchDepth: runtimeConfig.search.defaultDepth,
          })
          return
        }
      }
    },
    [
      createConversation,
      deleteConversation,
      executeSearch,
      refreshModels,
      router,
      runtimeConfigQuery.data,
      updateConversation,
      utils.conversation.list,
      utils.model.list,
    ],
  )

  return { handleAction }
}
