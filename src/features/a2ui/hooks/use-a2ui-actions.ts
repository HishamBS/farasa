'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/provider'
import { ROUTES } from '@/config/routes'
import {
  A2UI_ACTIONS,
  A2UI_ACTION_EXACT,
  A2UI_ACTION_PREFIXES,
  BROWSER_EVENTS,
} from '@/config/constants'
import type { ActionPayload } from '@a2ui-sdk/types/0.8'
import type { RuntimeConfig } from '@/schemas/runtime-config'

export function useA2UIActions() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const createConversation = trpc.conversation.create.useMutation()
  const updateConversation = trpc.conversation.update.useMutation()
  const deleteConversation = trpc.conversation.delete.useMutation()
  const refreshModels = trpc.model.refresh.useMutation()
  const executeSearch = trpc.search.execute.useMutation()
  const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()
  const runtimeConfigRef = useRef<RuntimeConfig | undefined>(undefined)
  runtimeConfigRef.current = runtimeConfigQuery.data

  const dispatchActionPrompt = useCallback(
    (payload: { prompt: string; webSearchEnabled?: boolean }) => {
      window.dispatchEvent(
        new CustomEvent(BROWSER_EVENTS.A2UI_ACTION_REQUESTED, {
          detail: payload,
        }),
      )
    },
    [],
  )

  const buildContextSummary = useCallback((action: ActionPayload): string => {
    const entries = Object.entries(action.context ?? {})
    if (entries.length === 0) return ''
    return entries
      .map(([key, value]) =>
        typeof value === 'string' ? `${key}: ${value}` : `${key}: ${JSON.stringify(value)}`,
      )
      .join('\n')
  }, [])

  const getContextValue = useCallback((action: ActionPayload, key: string): unknown => {
    if (!action.context || typeof action.context !== 'object') return undefined
    return (action.context as Record<string, unknown>)[key]
  }, [])

  const handleAction = useCallback(
    (action: ActionPayload) => {
      const rawName = typeof action.name === 'string' ? action.name.trim() : ''
      if (!rawName) return
      const name = rawName.toLowerCase()
      switch (name) {
        case A2UI_ACTIONS.NEW_CHAT: {
          void createConversation.mutateAsync({}).then((conv) => {
            void utils.conversation.list.invalidate()
            router.push(ROUTES.CHAT_BY_ID(conv.id))
          })
          return
        }
        case A2UI_ACTIONS.RENAME: {
          const id = String(getContextValue(action, 'id') ?? '')
          const title = String(getContextValue(action, 'title') ?? '').trim()
          if (!id || !title) return
          void updateConversation
            .mutateAsync({ id, title })
            .then(() => utils.conversation.list.invalidate())
          return
        }
        case A2UI_ACTIONS.PIN:
        case A2UI_ACTIONS.UNPIN: {
          const id = String(getContextValue(action, 'id') ?? '')
          if (!id) return
          void updateConversation
            .mutateAsync({ id, isPinned: name === A2UI_ACTIONS.PIN })
            .then(() => utils.conversation.list.invalidate())
          return
        }
        case A2UI_ACTIONS.DELETE: {
          const id = String(getContextValue(action, 'id') ?? '')
          if (!id) return
          void deleteConversation.mutateAsync({ id }).then(() => {
            void utils.conversation.list.invalidate()
            router.push(ROUTES.CHAT)
          })
          return
        }
        case A2UI_ACTIONS.REFRESH_MODELS: {
          void refreshModels.mutateAsync({ force: true }).then(() => utils.model.list.invalidate())
          return
        }
        case A2UI_ACTIONS.SEARCH: {
          const query = String(getContextValue(action, 'query') ?? '').trim()
          if (!query) return
          const runtimeConfig = runtimeConfigRef.current
          if (!runtimeConfig) return
          void executeSearch.mutateAsync({
            query,
            includeImages: runtimeConfig.search.includeImagesByDefault,
            maxResults: runtimeConfig.limits.searchMaxResults,
            searchDepth: runtimeConfig.search.defaultDepth,
          })
          dispatchActionPrompt({
            prompt: `Search the web for: ${query}`,
            webSearchEnabled: true,
          })
          return
        }
        default:
          break
      }

      // Form submission actions (prefix match for model-generated names like "submit_appointment")
      if (
        name.startsWith(A2UI_ACTION_PREFIXES.SUBMIT) ||
        name.startsWith(A2UI_ACTION_PREFIXES.PARSE) ||
        name === A2UI_ACTION_EXACT.GENERATE ||
        name === A2UI_ACTION_EXACT.TRANSFORM
      ) {
        const summary = buildContextSummary(action)
        dispatchActionPrompt({
          prompt: [
            `The user submitted the form from the interactive A2UI artifact you generated.`,
            `Action: "${rawName}"`,
            `Submitted data:`,
            summary,
            ``,
            `Process this submission meaningfully:`,
            `- Acknowledge what was submitted with specific field values`,
            `- Validate the data (flag any issues like missing required fields or invalid formats)`,
            `- Explain what would happen next in a real system`,
            `- If appropriate, generate a follow-up A2UI artifact (e.g., a success confirmation card or next-step form)`,
          ].join('\n'),
          webSearchEnabled: false,
        })
        return
      }

      // Cancel actions (prefix match for "cancel_form", "cancel_booking", etc.)
      if (name.startsWith(A2UI_ACTION_PREFIXES.CANCEL)) {
        dispatchActionPrompt({
          prompt: `The user cancelled the form from the interactive A2UI artifact. Acknowledge the cancellation briefly and ask if they'd like to try something different.`,
          webSearchEnabled: false,
        })
        return
      }

      // Generic action handler
      {
        const summary = buildContextSummary(action)
        dispatchActionPrompt({
          prompt: [
            `The user triggered action "${rawName}" from the interactive A2UI artifact.`,
            summary ? `Context data:\n${summary}` : '',
            `Respond appropriately to this action.`,
          ]
            .filter(Boolean)
            .join('\n'),
          webSearchEnabled: false,
        })
        return
      }
    },
    [
      buildContextSummary,
      createConversation,
      dispatchActionPrompt,
      deleteConversation,
      executeSearch,
      refreshModels,
      getContextValue,
      router,
      updateConversation,
      utils.conversation.list,
      utils.model.list,
    ],
  )

  return { handleAction }
}
