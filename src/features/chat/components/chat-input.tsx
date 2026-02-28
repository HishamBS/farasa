'use client'

import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Send, Paperclip } from 'lucide-react'
import { scaleIn } from '@/lib/utils/motion'
import { StopButton } from './stop-button'
import { cn } from '@/lib/utils/cn'
import { APP_CONFIG, SUPPORTED_FILE_TYPES, UI_TEXT } from '@/config/constants'
import { useChatInput } from '../hooks/use-chat-input'
import { useFileUpload } from '../hooks/use-file-upload'
import { useChatMode } from '../context/chat-mode-context'
import { ModelSelector } from './model-selector'
import { ModeToggle } from './mode-toggle'
import { AttachmentPreview } from './attachment-preview'
import { MicButton } from '@/features/voice/components/mic-button'
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

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, onAbort, isStreaming, conversationId, initialModel },
  ref,
) {
  const shouldReduce = useReducedMotion()
  const modelSelectorRef = useRef<ModelSelectorHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const {
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
  } = useChatInput(initialModel)

  const { mode, setMode } = useChatMode()

  const { uploadFile, uploadStates, removeFile } = useFileUpload()

  useImperativeHandle(ref, () => ({ setContent: setExternalContent }))

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

  const canSend = useMemo(() => content.trim().length > 0 && !isStreaming, [content, isStreaming])

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return
      for (const file of Array.from(files)) {
        const attachmentId = await uploadFile(file)
        if (attachmentId) addAttachment(attachmentId)
      }
    },
    [uploadFile, addAttachment],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void handleFiles(e.target.files)
      e.target.value = ''
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      void handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleTranscript = useCallback(
    (text: string) => {
      setExternalContent(text)
    },
    [setExternalContent],
  )

  return (
    <div className="border-t border-[--border-subtle] bg-[--bg-root] [padding-bottom:env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-[var(--content-max-width)] px-5 pb-4 pt-2.5 lg:px-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'rounded-2xl border bg-[--bg-glass] px-3 py-2.5 shadow-[0_2px_20px_rgba(0,0,0,0.2)] backdrop-blur-2xl',
            isDragging
              ? 'border-[--accent] ring-4 ring-[--accent-muted]'
              : 'border-[--border-default] focus-within:border-[--accent-focus]',
          )}
        >
          {uploadStates.size > 0 && (
            <div className="mb-2 flex flex-col gap-1">
              {[...uploadStates.entries()].map(([fileName, state]) => (
                <AttachmentPreview
                  key={fileName}
                  fileName={fileName}
                  uploadState={state}
                  onRemove={() => {
                    removeFile(fileName)
                    if (state.attachmentId) removeAttachment(state.attachmentId)
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKey}
              placeholder={APP_CONFIG.CHAT_PLACEHOLDER}
              rows={1}
              className="min-h-6 max-h-[7.5rem] w-full resize-none bg-transparent text-sm text-[--text-primary] placeholder:text-[--text-muted] outline-none"
              disabled={isStreaming}
            />

            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORTED_FILE_TYPES.join(',')}
                onChange={handleFileInput}
                className="hidden"
                multiple
              />

              <button
                type="button"
                onClick={handleAttachClick}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-secondary]"
                aria-label="Attach file"
              >
                <Paperclip className="size-4" />
              </button>

              <MicButton onTranscript={handleTranscript} />

              <AnimatePresence mode="wait">
                {isStreaming ? (
                  <motion.div
                    key="stop"
                    {...(shouldReduce ? {} : scaleIn)}
                    exit={
                      shouldReduce ? {} : { scale: 0.8, opacity: 0, transition: { duration: 0.15 } }
                    }
                  >
                    <StopButton onAbort={onAbort} />
                  </motion.div>
                ) : (
                  <motion.button
                    key="send"
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSend}
                    className={cn(
                      'flex min-h-8 min-w-8 items-center justify-center rounded-lg transition-transform',
                      canSend
                        ? 'bg-[--accent] text-[--bg-root] hover:scale-[1.08] hover:bg-[--accent-hover]'
                        : 'bg-[--bg-surface-hover] text-[--text-ghost]',
                    )}
                    {...(shouldReduce ? {} : scaleIn)}
                    exit={
                      shouldReduce ? {} : { scale: 0.8, opacity: 0, transition: { duration: 0.15 } }
                    }
                    aria-label="Send message"
                  >
                    <Send size={14} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <ModelSelector
              ref={modelSelectorRef}
              value={selectedModel}
              onChange={setSelectedModel}
            />
            <ModeToggle value={mode} onChange={setMode} />

            <button
              type="button"
              onClick={handleAttachClick}
              className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-secondary] sm:inline-flex"
            >
              <Paperclip size={12} />
              Attach file
            </button>

            <span className="ml-auto hidden text-xs text-[--text-ghost] sm:block">
              {UI_TEXT.CHAT_KEYBOARD_HINT}
            </span>
          </div>

          {mode === 'search' && (
            <div className="mt-1 text-xs text-[--text-muted]">Search mode is active.</div>
          )}
        </div>
      </div>
    </div>
  )
})
