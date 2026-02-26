'use client'

import { useState, useCallback, useRef } from 'react'
import { CHAT_MODES, UX } from '@/config/constants'
import type { SearchMode } from '@/schemas/search'

export function useChatInput() {
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<SearchMode>(CHAT_MODES.CHAT)
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string | undefined>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const setExternalContent = useCallback((text: string) => {
    setContent(text)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, UX.TEXTAREA_MAX_HEIGHT_PIXELS)}px`
      el.focus()
    })
  }, [textareaRef])

  return {
    content,
    mode,
    attachmentIds,
    selectedModel,
    textareaRef,
    setMode,
    setSelectedModel,
    handleContentChange,
    handleKeyDown,
    clear,
    addAttachment,
    removeAttachment,
    setExternalContent,
  }
}
