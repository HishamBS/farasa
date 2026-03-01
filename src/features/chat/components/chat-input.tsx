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
import { ArrowRight, Paperclip } from 'lucide-react'
import { scaleIn } from '@/lib/utils/motion'
import { StopButton } from './stop-button'
import { cn } from '@/lib/utils/cn'
import { APP_CONFIG, UI_TEXT, MOTION, LIMITS } from '@/config/constants'
import { useChatInput } from '../hooks/use-chat-input'
import { useFileUpload } from '../hooks/use-file-upload'
import { useChatMode } from '../context/chat-mode-context'
import { ModelSelector } from './model-selector'
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

  const { mode } = useChatMode()

  const { uploadFile, uploadFileInline, gcsEnabled, uploadStates, removeFile, supportedFileTypes } =
    useFileUpload()

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
    const inlineAttachments = [...uploadStates.values()]
      .filter((s) => s.inlineDataUrl && !s.isUploading && !s.error)
      .map((s) => ({ dataUrl: s.inlineDataUrl!, fileName: s.fileName, fileType: s.fileType }))
    onSend({
      content: content.trim(),
      mode,
      model: selectedModel,
      conversationId,
      attachmentIds,
      inlineAttachments,
    })
    clear()
  }, [
    content,
    mode,
    selectedModel,
    conversationId,
    attachmentIds,
    uploadStates,
    isStreaming,
    onSend,
    clear,
  ])

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      handleKeyDown(e, handleSubmit, isStreaming ? onAbort : undefined)
    },
    [handleKeyDown, handleSubmit, isStreaming, onAbort],
  )

  const isTooLong = content.length > LIMITS.MESSAGE_MAX_LENGTH
  const canSend = useMemo(
    () => content.trim().length > 0 && !isStreaming && !isTooLong,
    [content, isStreaming, isTooLong],
  )

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return
      for (const file of Array.from(files)) {
        if (gcsEnabled) {
          const uploaded = await uploadFile(file)
          if (uploaded) addAttachment(uploaded.attachmentId)
        } else {
          await uploadFileInline(file)
        }
      }
    },
    [gcsEnabled, uploadFile, uploadFileInline, addAttachment],
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
    <div className="shrink-0 pb-4 xl:pb-6">
      <div className="mx-auto w-full max-w-170 px-5">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'rounded-[16px] border bg-(--bg-glass) p-2.5 shadow-md backdrop-blur-xl saturate-150 transition-all duration-300',
            isDragging
              ? 'border-accent ring-4 ring-accent/20'
              : 'border-(--border-default) focus-within:border-accent/30 focus-within:ring-4 focus-within:ring-accent/10 focus-within:shadow-xl',
          )}
        >
          {uploadStates.size > 0 && (
            <div className="mb-2 flex flex-col gap-1">
              {[...uploadStates.entries()].map(([token, state]) => (
                <AttachmentPreview
                  key={token}
                  fileName={state.fileName}
                  uploadState={state}
                  onRemove={() => {
                    removeFile(token)
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
              className="min-h-6 max-h-30 w-full resize-none bg-transparent text-sm text-(--text-primary) placeholder:text-(--text-muted) outline-none"
              disabled={isStreaming}
            />

            <div className="flex items-end gap-1 mb-0.5">
              <input
                ref={fileInputRef}
                type="file"
                accept={supportedFileTypes.join(',')}
                onChange={handleFileInput}
                className="hidden"
                multiple
              />

              <button
                type="button"
                onClick={handleAttachClick}
                className="flex size-8 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
                aria-label="Attach file"
              >
                <Paperclip size={15} />
              </button>

              <MicButton onTranscript={handleTranscript} />

              <AnimatePresence mode="wait">
                {isStreaming ? (
                  <motion.div
                    key="stop"
                    {...(shouldReduce ? {} : scaleIn)}
                    exit={
                      shouldReduce
                        ? {}
                        : {
                            scale: MOTION.SCALE_EXIT,
                            opacity: 0,
                            transition: { duration: MOTION.DURATION_EXTRA_FAST },
                          }
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
                      'flex size-8 items-center justify-center rounded-lg transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                      canSend
                        ? 'bg-accent text-(--bg-root) shadow-md shadow-accent/20 hover:scale-[1.08] hover:bg-accent'
                        : 'bg-(--bg-surface-active) text-(--text-ghost) cursor-not-allowed',
                    )}
                    {...(shouldReduce ? {} : scaleIn)}
                    exit={
                      shouldReduce
                        ? {}
                        : {
                            scale: MOTION.SCALE_EXIT,
                            opacity: 0,
                            transition: { duration: MOTION.DURATION_EXTRA_FAST },
                          }
                    }
                    aria-label="Send message"
                  >
                    <ArrowRight
                      size={14}
                      strokeWidth={2.5}
                      className={canSend ? 'translate-x-[0.5px] translate-y-[-0.5px]' : ''}
                    />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="mt-1.5 flex items-center gap-2.5">
          <ModelSelector ref={modelSelectorRef} value={selectedModel} onChange={setSelectedModel} />

          <button
            type="button"
            onClick={handleAttachClick}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
          >
            <Paperclip size={14} />
            Attach file
          </button>

          <span className="ml-auto text-[11.5px] text-(--text-muted) hidden sm:block tracking-wide">
            {isTooLong ? (
              <span className="text-(--error)">
                {content.length.toLocaleString()} / {LIMITS.MESSAGE_MAX_LENGTH.toLocaleString()} —
                message too long
              </span>
            ) : (
              UI_TEXT.CHAT_KEYBOARD_HINT
            )}
          </span>
        </div>

        {mode === 'search' && (
          <div className="mt-1 px-1 text-xs text-(--text-muted)">Search mode is active.</div>
        )}
      </div>
    </div>
  )
})
