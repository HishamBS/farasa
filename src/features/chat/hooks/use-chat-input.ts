'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { BROWSER_EVENTS, UX } from '@/config/constants'
import { useStreamSession } from '../context/stream-session-context'

export function useChatInput(initialModel?: string | null, conversationId?: string) {
  const [content, setContent] = useState('')
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const selectedModelRef = useRef<string | undefined>(initialModel ?? undefined)
  const lastConversationIdRef = useRef<string | undefined>(conversationId)
  const lastPersistedModelRef = useRef<{
    conversationId?: string
    model?: string
  }>({})
  const pendingConversationModelRef = useRef<{ pending: boolean; value: string | undefined }>({
    pending: false,
    value: undefined,
  })
  const [selectedModel, setSelectedModelState] = useState<string | undefined>(
    selectedModelRef.current,
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const utils = trpc.useUtils()
  const { isTurnActive } = useStreamSession()

  const prefsQuery = trpc.userPreferences.get.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
  })
  const updatePrefsMutation = trpc.userPreferences.update.useMutation()
  const updateConversationMutation = trpc.conversation.update.useMutation({
    onSuccess: (_data, variables) => {
      if (variables.model !== undefined) {
        utils.conversation.getById.setData({ id: variables.id }, (old) =>
          old ? { ...old, model: variables.model ?? null } : old,
        )
      }
    },
  })

  // Only reset selection when conversation identity changes.
  // This prevents stale server echoes from overwriting a freshly selected model.
  useEffect(() => {
    const previousConversationId = lastConversationIdRef.current
    if (previousConversationId === conversationId) return
    lastConversationIdRef.current = conversationId

    const transitionedFromDraftToPersisted = !previousConversationId && !!conversationId
    const hasLocalSelection = typeof selectedModelRef.current === 'string'
    const serverModelUnresolved = initialModel === undefined || initialModel === null

    if (transitionedFromDraftToPersisted && hasLocalSelection && serverModelUnresolved) {
      setSelectedModelState(selectedModelRef.current)
      updateConversationMutation.mutate({
        id: conversationId,
        model: selectedModelRef.current,
      })
      lastPersistedModelRef.current = {
        conversationId,
        model: selectedModelRef.current,
      }
      return
    }

    selectedModelRef.current = initialModel ?? undefined
    setSelectedModelState(selectedModelRef.current)
  }, [conversationId, initialModel, updateConversationMutation])

  useEffect(() => {
    const handleNewChatRequested = () => {
      selectedModelRef.current = undefined
      setSelectedModelState(undefined)
      pendingConversationModelRef.current = { pending: false, value: undefined }
    }
    window.addEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, handleNewChatRequested)
    return () => {
      window.removeEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, handleNewChatRequested)
    }
  }, [])

  useEffect(() => {
    if (isTurnActive || !conversationId) return
    if (!pendingConversationModelRef.current.pending) return

    const { value } = pendingConversationModelRef.current
    pendingConversationModelRef.current = { pending: false, value: undefined }
    updateConversationMutation.mutate({
      id: conversationId,
      model: value ?? null,
    })
    lastPersistedModelRef.current = { conversationId, model: value }
  }, [conversationId, isTurnActive, updateConversationMutation])

  useEffect(() => {
    if (!conversationId || isTurnActive) return
    const localModel = selectedModelRef.current
    const serverModel = initialModel ?? undefined
    if (localModel === serverModel) return
    if (
      lastPersistedModelRef.current.conversationId === conversationId &&
      lastPersistedModelRef.current.model === localModel
    ) {
      return
    }
    updateConversationMutation.mutate({
      id: conversationId,
      model: localModel ?? null,
    })
    lastPersistedModelRef.current = { conversationId, model: localModel }
  }, [conversationId, initialModel, isTurnActive, updateConversationMutation])

  const setSelectedModel = useCallback(
    (modelId: string | undefined) => {
      selectedModelRef.current = modelId
      setSelectedModelState(modelId)
      if (!conversationId) return
      if (isTurnActive) {
        pendingConversationModelRef.current = { pending: true, value: modelId }
        return
      }
      updateConversationMutation.mutate({
        id: conversationId,
        model: modelId ?? null,
      })
      lastPersistedModelRef.current = { conversationId, model: modelId }
    },
    [conversationId, isTurnActive, updateConversationMutation],
  )

  const setDefaultModel = useCallback(
    (modelId: string | undefined) => {
      updatePrefsMutation.mutate({ defaultModel: modelId ?? null })
    },
    [updatePrefsMutation],
  )

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, UX.TEXTAREA_MAX_HEIGHT_PIXELS)}px`
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, onSubmit: () => void, onAbort?: () => void) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSubmit()
      } else if (e.key === 'Escape' && onAbort) {
        e.preventDefault()
        onAbort()
      }
    },
    [],
  )

  const clear = useCallback(() => {
    setContent('')
    setAttachmentIds([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [])

  const addAttachment = useCallback((id: string) => {
    setAttachmentIds((prev) => [...prev, id])
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachmentIds((prev) => prev.filter((a) => a !== id))
  }, [])

  const setExternalContent = useCallback(
    (text: string) => {
      setContent(text)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, UX.TEXTAREA_MAX_HEIGHT_PIXELS)}px`
        el.focus()
      })
    },
    [textareaRef],
  )

  return {
    content,
    attachmentIds,
    selectedModel,
    getSelectedModel: () => selectedModelRef.current,
    defaultModel: prefsQuery.data?.defaultModel ?? undefined,
    isSavingDefaultModel: updatePrefsMutation.isPending,
    isPersistingConversationModel: updateConversationMutation.isPending,
    textareaRef,
    setSelectedModel,
    setDefaultModel,
    handleContentChange,
    handleKeyDown,
    clear,
    addAttachment,
    removeAttachment,
    setExternalContent,
  }
}
