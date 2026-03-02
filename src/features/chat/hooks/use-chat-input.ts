'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/trpc/provider'
import { UX } from '@/config/constants'

export function useChatInput(initialModel?: string | null, conversationId?: string) {
  const [content, setContent] = useState('')
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const [selectedModel, setSelectedModelState] = useState<string | undefined>(
    initialModel ?? undefined,
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const prefsQuery = trpc.userPreferences.get.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
  })
  const updatePrefsMutation = trpc.userPreferences.update.useMutation()

  // Sync selectedModel when navigating to a different conversation or starting a fresh chat.
  useEffect(() => {
    setSelectedModelState(initialModel ?? undefined)
  }, [conversationId, initialModel])

  const setSelectedModel = useCallback((modelId: string | undefined) => {
    setSelectedModelState(modelId)
  }, [])

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
    defaultModel: prefsQuery.data?.defaultModel ?? undefined,
    isSavingDefaultModel: updatePrefsMutation.isPending,
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
