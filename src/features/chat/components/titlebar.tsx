'use client'

import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MOTION, NEW_CHAT_TITLE, UI_TEXT, UX } from '@/config/constants'
import { PATTERNS } from '@/config/routes'
import { useConversationOperations } from '@/features/sidebar/hooks/use-conversation-operations'
import type { TitlebarPhase } from '@/types/stream'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Download, Menu, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { trpc } from '@/trpc/provider'
import { useChatMode } from '../context/chat-mode-context'
import { ModeToggle } from './mode-toggle'

type TitlebarProps = {
  onMenuClick: () => void
  streamPhase?: TitlebarPhase
}

export function Titlebar({ onMenuClick, streamPhase = 'idle' }: TitlebarProps) {
  const pathname = usePathname()
  const { mode, setMode, setActiveConversationId } = useChatMode()
  const { updateMutation, deleteMutation, isExporting, handleExport } = useConversationOperations({
    navigateOnDelete: true,
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    if (streamPhase === 'done') {
      setShowDone(true)
      const timer = setTimeout(() => setShowDone(false), UX.DONE_NOTIFICATION_DURATION_MS)
      return () => clearTimeout(timer)
    } else {
      setShowDone(false)
    }
  }, [streamPhase])

  const conversationId = useMemo(() => {
    const match = PATTERNS.CHAT_ID.exec(pathname)
    return match?.[1] ?? null
  }, [pathname])

  const { data: conversation, isLoading: isLoadingConversation } =
    trpc.conversation.getById.useQuery(
      { id: conversationId ?? '' },
      { enabled: !!conversationId, staleTime: UX.QUERY_STALE_TIME_FOREVER },
    )

  useEffect(() => {
    setActiveConversationId(conversationId ?? undefined)
  }, [conversationId, setActiveConversationId])

  const handlePin = useCallback(() => {
    if (!conversationId || !conversation) return
    updateMutation.mutate({ id: conversationId, isPinned: !conversation.isPinned })
  }, [conversationId, conversation, updateMutation])

  const handleDeleteConfirmed = useCallback(() => {
    if (!conversationId) return
    deleteMutation.mutate({ id: conversationId })
  }, [conversationId, deleteMutation])

  const handleRenameOpen = useCallback(() => {
    if (!conversation) return
    setRenameValue(conversation.title)
    setShowRenameDialog(true)
  }, [conversation])

  const handleRenameSave = useCallback(() => {
    if (!conversationId) return
    const nextTitle = renameValue.trim()
    if (!nextTitle) return
    updateMutation.mutate({ id: conversationId, title: nextTitle })
    setShowRenameDialog(false)
  }, [conversationId, renameValue, updateMutation])

  const handleExportClick = useCallback(() => {
    if (!conversationId) return
    void handleExport(conversationId)
  }, [conversationId, handleExport])

  const title = conversation?.title ?? null

  const pillInfo = useMemo(() => {
    if (streamPhase === 'thinking') {
      return {
        bg: 'bg-(--thinking-bg)',
        border: 'border-(--thinking-border)',
        text: 'text-(--thinking)',
        label: 'Thinking',
        showDot: true,
      }
    }
    if (streamPhase === 'streaming') {
      return {
        bg: 'bg-(--accent-muted)',
        border: 'border-(--accent-glow)',
        text: 'text-(--accent)',
        label: 'Generating',
        showDot: true,
      }
    }
    if (streamPhase === 'done') {
      return {
        bg: 'bg-(--success)/10',
        border: 'border-(--success)/20',
        text: 'text-(--success)',
        label: 'Ready',
        showDot: false,
      }
    }
    return null
  }, [streamPhase])
  const isPillVisible =
    streamPhase === 'thinking' ||
    streamPhase === 'streaming' ||
    (streamPhase === 'done' && showDone)

  const isAwaitingTitleGen =
    !!conversationId &&
    title === NEW_CHAT_TITLE &&
    (streamPhase === 'thinking' ||
      streamPhase === 'streaming' ||
      (streamPhase === 'done' && showDone))
  const showTitleSkeleton = (!!conversationId && isLoadingConversation) || isAwaitingTitleGen

  return (
    <>
      <header className="relative z-20 flex h-12 shrink-0 items-center gap-2.5 border-b border-(--border-subtle) bg-(--bg-root) px-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(white/5) hover:text-(--text-secondary)"
          aria-label={UI_TEXT.OPEN_SIDEBAR_ARIA}
        >
          <Menu size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="truncate max-w-xs">
            {showTitleSkeleton ? (
              <span className="inline-block h-4 w-24 animate-pulse rounded bg-(--bg-surface-active)" />
            ) : title ? (
              <span className="text-sm font-medium text-(--text-secondary)">{title}</span>
            ) : (
              <span className="text-sm font-medium text-(--text-muted)">{NEW_CHAT_TITLE}</span>
            )}
          </div>
        </div>

        <div className="flex-1" />

        <AnimatePresence mode="wait">
          {pillInfo && isPillVisible && (
            <motion.div
              key={pillInfo.label}
              initial={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: MOTION.PILL_OFFSET_Y, scale: MOTION.PILL_SCALE }}
              transition={{ duration: MOTION.DURATION_FAST }}
              className={`mr-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${pillInfo.bg} ${pillInfo.border} ${pillInfo.text}`}
            >
              {pillInfo.showDot ? (
                <span className="size-1.5 rounded-full bg-current animate-pulse" />
              ) : (
                <Check size={12} />
              )}
              <span>{pillInfo.label}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <ModeToggle value={mode} onChange={setMode} />

        {conversationId && conversation && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
                aria-label={UI_TEXT.MORE_OPTIONS_ARIA}
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRenameOpen}>
                <Pencil size={14} className="mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportClick} disabled={isExporting}>
                <Download size={14} className="mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePin}>
                {conversation.isPinned ? (
                  <>
                    <PinOff size={14} className="mr-2" />
                    Unpin
                  </>
                ) : (
                  <>
                    <Pin size={14} className="mr-2" />
                    Pin
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-(--error) focus:text-(--error)"
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConfirmed}
      />

      <AlertDialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Conversation</AlertDialogTitle>
            <AlertDialogDescription>Choose a clear title for this thread.</AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            className="w-full rounded-md border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) outline-none focus:border-accent"
            placeholder="Conversation title"
            maxLength={255}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameSave}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
