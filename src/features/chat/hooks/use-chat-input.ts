'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { BROWSER_EVENTS, UX } from '@/config/constants'

export function useChatInput(initialModel?: string | null, conversationId?: string) {
  const [content, setContent] = useState('')
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const selectedModelRef = useRef<string | undefined>(initialModel ?? undefined)
  const lastConversationIdRef = useRef<string | undefined>(conversationId)
  const [selectedModel, setSelectedModelState] = useState<string | undefined>(
    selectedModelRef.current,
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const prefsQuery = trpc.userPreferences.get.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
  })
  const updatePrefsMutation = trpc.userPreferences.update.useMutation()
  const updateConversationMutation = trpc.conversation.update.useMutation()

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
      return
    }

    selectedModelRef.current = initialModel ?? undefined
    setSelectedModelState(selectedModelRef.current)
  }, [conversationId, initialModel, updateConversationMutation])

  useEffect(() => {
    const handleNewChatRequested = () => {
      if (conversationId) return
      selectedModelRef.current = undefined
      setSelectedModelState(undefined)
    }
    window.addEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, handleNewChatRequested)
    return () => {
      window.removeEventListener(BROWSER_EVENTS.NEW_CHAT_REQUESTED, handleNewChatRequested)
    }
  }, [conversationId])

  const setSelectedModel = useCallback(
    (modelId: string | undefined) => {
      selectedModelRef.current = modelId
      setSelectedModelState(modelId)
      if (!conversationId) return
      updateConversationMutation.mutate({
        id: conversationId,
        model: modelId ?? null,
      })
    },
    [conversationId, updateConversationMutation],
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
