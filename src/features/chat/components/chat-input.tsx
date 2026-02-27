'use client'

import { useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Send, Square } from 'lucide-react'
import { scaleIn } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { APP_CONFIG } from '@/config/constants'
import { useChatInput } from '../hooks/use-chat-input'
import { ModelSelector } from './model-selector'
import { ModeToggle } from './mode-toggle'
import type { ModelSelectorHandle } from './model-selector'
import type { ChatInput as ChatInputType } from '@/schemas/message'

export type ChatInputHandle = {
  setContent: (text: string) => void
}

type ChatInputProps = {
  onSend: (input: ChatInputType) => void
  onAbort: () => void
  isStreaming: boolean
  conversationId?: string
  initialModel?: string | null
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput({ onSend, onAbort, isStreaming, conversationId, initialModel }, ref) {
    const shouldReduce = useReducedMotion()
    const modelSelectorRef = useRef<ModelSelectorHandle>(null)

    const {
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
      setExternalContent,
    } = useChatInput(initialModel)

    useImperativeHandle(ref, () => ({ setContent: setExternalContent }))

    // Cmd/Ctrl+K opens the model selector from anywhere in the page
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault()
          modelSelectorRef.current?.open()
        }
      }
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }, [])

    const handleSubmit = useCallback(() => {
      if (!content.trim() || isStreaming) return
      onSend({
        content: content.trim(),
        mode,
        model: selectedModel,
        conversationId,
        attachmentIds,
      })
      clear()
    }, [content, mode, selectedModel, conversationId, attachmentIds, isStreaming, onSend, clear])

    const handleKey = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        handleKeyDown(e, handleSubmit)
      },
      [handleKeyDown, handleSubmit],
    )

    const canSend = useMemo(
      () => content.trim().length > 0 && !isStreaming,
      [content, isStreaming],
    )

    return (
      // env(safe-area-inset-bottom) prevents the input from being obscured on notched devices
      <div className="border-t border-[--border-subtle] bg-[--bg-root] [padding-bottom:env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-4 py-3 lg:px-6">
          <div className="flex flex-col gap-2 rounded-2xl border border-[--border-default] bg-[--bg-glass] px-4 pb-2 pt-3 backdrop-blur-xl">
            {/* max-h-48 = UX.TEXTAREA_MAX_HEIGHT_PIXELS (192px) */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKey}
              placeholder={APP_CONFIG.CHAT_PLACEHOLDER}
              rows={1}
              className="min-h-6 w-full resize-none bg-transparent text-sm text-[--text-primary] placeholder:text-[--text-ghost] outline-none max-h-48"
              disabled={isStreaming}
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ModelSelector
                  ref={modelSelectorRef}
                  value={selectedModel}
                  onChange={setSelectedModel}
                />
                <ModeToggle value={mode} onChange={setMode} />
              </div>

              {isStreaming ? (
                <motion.button
                  type="button"
                  onClick={onAbort}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[--error] text-[--error] hover:bg-[--error]/10"
                  {...(shouldReduce ? {} : scaleIn)}
                  aria-label="Stop generating"
                >
                  <Square size={14} />
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSend}
                  className={cn(
                    'flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors',
                    canSend
                      ? 'bg-[--accent] text-[--bg-root] hover:bg-[--accent-hover]'
                      : 'bg-[--bg-surface-hover] text-[--text-ghost]',
                  )}
                  {...(shouldReduce ? {} : scaleIn)}
                  aria-label="Send message"
                >
                  <Send size={14} />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  },
)
