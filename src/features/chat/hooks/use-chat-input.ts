'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { UX } from '@/config/constants'

export function useChatInput(initialModel?: string | null) {
  const [content, setContent] = useState('')
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    initialModel ?? undefined,
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync selectedModel when navigating to a different conversation.
  // undefined = still loading; null = loaded with no model set; string = specific model
  useEffect(() => {
    if (initialModel !== undefined) {
      setSelectedModel(initialModel ?? undefined)
    }
  }, [initialModel])

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value)
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, UX.TEXTAREA_MAX_HEIGHT_PIXELS)}px`
    },
    [],
  )

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      onSubmit: () => void,
    ) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSubmit()
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
    textareaRef,
    setSelectedModel,
    handleContentChange,
    handleKeyDown,
    clear,
    addAttachment,
    removeAttachment,
    setExternalContent,
  }
}
