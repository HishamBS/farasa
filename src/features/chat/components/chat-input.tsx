'use client'

import { APP_CONFIG, CHAT_MODES, LIMITS, MOTION, UI_TEXT } from '@/config/constants'
import { TeamModelPicker } from '@/features/team/components/team-model-picker'
import { useTeamMode } from '@/features/team/context/team-context'
import { MicButton } from '@/features/voice/components/mic-button'
import { cn } from '@/lib/utils/cn'
import { scaleIn } from '@/lib/utils/motion'
import type { ChatInput as ChatInputType } from '@/schemas/message'
import type { TeamStreamInput } from '@/schemas/team'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Globe, Paperclip } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useChatMode } from '../context/chat-mode-context'
import { useChatInput } from '../hooks/use-chat-input'
import { useFileUpload } from '../hooks/use-file-upload'
import { AttachmentPreview } from './attachment-preview'
import type { ModelSelectorHandle } from './model-selector'
import { ModelSelector } from './model-selector'
import { StopButton } from './stop-button'

export type ChatInputHandle = {
  setContent: (text: string) => void
}

type ChatInputProps = {
  onSend: (input: ChatInputType) => void
  onAbort: () => void
  isStreaming: boolean
  conversationId?: string
  initialModel?: string | null
  onTeamSubmit?: (input: TeamStreamInput) => void
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, onAbort, isStreaming, conversationId, initialModel, onTeamSubmit },
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
    getSelectedModel,
    defaultModel,
    isSavingDefaultModel,
    isPersistingConversationModel,
    textareaRef,
    setSelectedModel,
    setDefaultModel,
    handleContentChange,
    handleKeyDown,
    clear,
    addAttachment,
    removeAttachment,
    setExternalContent,
  } = useChatInput(initialModel, conversationId)

  const { mode, webSearchEnabled, setWebSearchEnabled } = useChatMode()
  const { teamModels } = useTeamMode()

  const {
    uploadFile,
    uploadFileInline,
    gcsEnabled,
    uploadStates,
    removeFile,
    clearFiles,
    supportedFileTypes,
  } = useFileUpload()

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

  const isTooLong = content.length > LIMITS.MESSAGE_MAX_LENGTH
  const hasUploadingFiles = useMemo(
    () => [...uploadStates.values()].some((state) => state.isUploading),
    [uploadStates],
  )
  const hasUploadErrors = useMemo(
    () => [...uploadStates.values()].some((state) => Boolean(state.error)),
    [uploadStates],
  )
  const canSend = useMemo(() => {
    if (
      content.trim().length === 0 ||
      isStreaming ||
      isTooLong ||
      hasUploadingFiles ||
      hasUploadErrors
    ) {
      return false
    }
    return true
  }, [content, hasUploadErrors, hasUploadingFiles, isStreaming, isTooLong])

  const handleSubmit = useCallback(() => {
    if (!content.trim() || isStreaming || isTooLong || hasUploadingFiles || hasUploadErrors) return
    const modelForSubmission = getSelectedModel()
    if (mode === CHAT_MODES.TEAM) {
      if (onTeamSubmit) {
        onTeamSubmit({
          clientRequestId: crypto.randomUUID(),
          content: content.trim(),
          models: teamModels,
          conversationId,
          attachmentIds,
          webSearchEnabled,
        })
        clear()
        clearFiles()
      }
      return
    }
    onSend({
      content: content.trim(),
      mode,
      model: modelForSubmission ?? null,
      conversationId,
      attachmentIds,
      webSearchEnabled,
    })
    clear()
    clearFiles()
  }, [
    content,
    isTooLong,
    mode,
    getSelectedModel,
    conversationId,
    attachmentIds,
    webSearchEnabled,
    isStreaming,
    hasUploadingFiles,
    hasUploadErrors,
    teamModels,
    onSend,
    onTeamSubmit,
    clear,
    clearFiles,
  ])

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      handleKeyDown(e, handleSubmit, isStreaming ? onAbort : undefined)
    },
    [handleKeyDown, handleSubmit, isStreaming, onAbort],
  )

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return
      const uploadFn = gcsEnabled ? uploadFile : uploadFileInline
      const results = await Promise.all(Array.from(files).map((file) => uploadFn(file)))
      for (const uploaded of results) {
        if (uploaded) addAttachment(uploaded.attachmentId)
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

  const handleInterimTranscript = useCallback(
    (text: string) => {
      setExternalContent(text)
    },
    [setExternalContent],
  )

  const handleWebSearchToggle = useCallback(() => {
    setWebSearchEnabled(!webSearchEnabled)
  }, [setWebSearchEnabled, webSearchEnabled])

  const handleSetDefaultModel = useCallback(() => {
    setDefaultModel(selectedModel)
  }, [setDefaultModel, selectedModel])

  return (
    <div className="shrink-0 pb-[max(1rem,_env(safe-area-inset-bottom))] xl:pb-6">
      <div className="mx-auto w-full max-w-240 px-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'rounded-2xl border bg-(--bg-glass) p-2.5 shadow-md backdrop-blur-xl saturate-150 transition-all duration-300',
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

              <button
                type="button"
                onClick={handleWebSearchToggle}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors',
                  webSearchEnabled
                    ? 'bg-(--accent-muted) text-(--accent) hover:bg-(--accent-muted)'
                    : 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)',
                )}
                aria-pressed={webSearchEnabled}
                aria-label={
                  webSearchEnabled ? UI_TEXT.WEB_SEARCH_DISABLE : UI_TEXT.WEB_SEARCH_ENABLE
                }
              >
                <Globe size={15} />
              </button>

              <MicButton
                onTranscript={handleTranscript}
                onInterimTranscript={handleInterimTranscript}
              />

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
          {mode === CHAT_MODES.TEAM ? (
            <TeamModelPicker />
          ) : (
            <>
              <ModelSelector
                ref={modelSelectorRef}
                value={selectedModel}
                onChange={setSelectedModel}
              />
              <button
                type="button"
                disabled={
                  isPersistingConversationModel ||
                  isSavingDefaultModel ||
                  (selectedModel ?? undefined) === (defaultModel ?? undefined)
                }
                onClick={handleSetDefaultModel}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  isSavingDefaultModel ||
                    isPersistingConversationModel ||
                    (selectedModel ?? undefined) === (defaultModel ?? undefined)
                    ? 'cursor-not-allowed text-(--text-ghost)'
                    : 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)',
                )}
              >
                {(selectedModel ?? undefined) === (defaultModel ?? undefined)
                  ? UI_TEXT.DEFAULT_MODEL_SET
                  : UI_TEXT.SET_DEFAULT_MODEL}
              </button>
            </>
          )}

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

        {mode === CHAT_MODES.TEAM && (
          <div className="mt-1 px-1 text-xs text-(--text-muted)">Team mode is active.</div>
        )}
        {webSearchEnabled && (
          <div className="mt-1 px-1 text-xs text-(--text-muted)">{UI_TEXT.WEB_SEARCH_ACTIVE}</div>
        )}
      </div>
    </div>
  )
})
