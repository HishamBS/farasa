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
  const updateConversationMutateRef = useRef(updateConversationMutation.mutate)
  updateConversationMutateRef.current = updateConversationMutation.mutate

  // Only reset selection when conversation identity changes.
  // This prevents stale server echoes from overwriting a freshly selected model.
  useEffect(() => {
    const previousConversationId = lastConversationIdRef.current
    if (previousConversationId === conversationId) {
      // Same conversation — sync when server model resolves and no local override
      if (initialModel && selectedModelRef.current === undefined) {
        selectedModelRef.current = initialModel
        setSelectedModelState(initialModel)
      }
      return
    }
    lastConversationIdRef.current = conversationId

    const transitionedFromDraftToPersisted = !previousConversationId && !!conversationId
    const hasLocalSelection = typeof selectedModelRef.current === 'string'
    const serverModelUnresolved = initialModel === undefined || initialModel === null

    if (transitionedFromDraftToPersisted && hasLocalSelection && serverModelUnresolved) {
      setSelectedModelState(selectedModelRef.current)
      updateConversationMutateRef.current({
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
  }, [conversationId, initialModel])

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
    updateConversationMutateRef.current({
      id: conversationId,
      model: value ?? null,
    })
    lastPersistedModelRef.current = { conversationId, model: value }
  }, [conversationId, isTurnActive])

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
    updateConversationMutateRef.current({
      id: conversationId,
      model: localModel ?? null,
    })
    lastPersistedModelRef.current = { conversationId, model: localModel }
  }, [conversationId, initialModel, isTurnActive])

  const setSelectedModel = useCallback(
    (modelId: string | undefined) => {
      selectedModelRef.current = modelId
      setSelectedModelState(modelId)
      if (!conversationId) return
      if (isTurnActive) {
        pendingConversationModelRef.current = { pending: true, value: modelId }
        return
      }
      updateConversationMutateRef.current({
        id: conversationId,
        model: modelId ?? null,
      })
      lastPersistedModelRef.current = { conversationId, model: modelId }
    },
    [conversationId, isTurnActive],
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
