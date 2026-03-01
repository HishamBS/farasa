'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, MoreHorizontal, Pin, PinOff, Trash2, Check } from 'lucide-react'
import { trpc } from '@/trpc/provider'
import { ROUTES, PATTERNS } from '@/config/routes'
import { UX, UI_TEXT, MOTION } from '@/config/constants'
import type { TitlebarPhase, ModelSelectionState } from '@/types/stream'
import { ModeToggle } from './mode-toggle'
import { RoutingPanel } from './routing-panel'
import { useChatMode } from '../context/chat-mode-context'
import { SearchModeSchema } from '@/schemas/search'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

type TitlebarProps = {
  onMenuClick: () => void
  streamPhase?: TitlebarPhase
  modelSelection?: ModelSelectionState | null
  hasText?: boolean
}

export function Titlebar({
  onMenuClick,
  streamPhase = 'idle',
  modelSelection = null,
  hasText = false,
}: TitlebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { mode, setMode } = useChatMode()
  const utils = trpc.useUtils()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
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

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: conversationId ?? '' },
    { enabled: !!conversationId, staleTime: UX.QUERY_STALE_TIME_FOREVER },
  )

  const { data: models = [] } = trpc.model.list.useQuery(undefined, {
    staleTime: UX.QUERY_STALE_TIME_FOREVER,
  })

  useEffect(() => {
    const parsed = SearchModeSchema.safeParse(conversation?.searchMode)
    if (parsed.success) setMode(parsed.data)
  }, [conversation?.searchMode, setMode])

  const updateMutation = trpc.conversation.update.useMutation({
    onSuccess: () => void utils.conversation.invalidate(),
  })

  const deleteMutation = trpc.conversation.delete.useMutation({
    onSuccess: () => {
      void utils.conversation.invalidate()
      router.push(ROUTES.CHAT)
    },
  })

  const handlePin = useCallback(() => {
    if (!conversationId || !conversation) return
    updateMutation.mutate({ id: conversationId, isPinned: !conversation.isPinned })
  }, [conversationId, conversation, updateMutation])

  const handleDeleteConfirmed = useCallback(() => {
    if (!conversationId) return
    deleteMutation.mutate({ id: conversationId })
  }, [conversationId, deleteMutation])

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

  return (
    <>
      <header className="relative z-20 flex h-12 shrink-0 items-center gap-2.5 border-b border-(--border-subtle) bg-(--bg-root) px-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(white/5) hover:text-(--text-secondary)"
          aria-label={UI_TEXT.OPEN_SIDEBAR_ARIA}
        >
          <Menu size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="truncate max-w-xs">
            {title ? (
              <span className="text-sm font-medium text-(--text-secondary)">{title}</span>
            ) : (
              <span className="text-sm font-medium text-(--text-muted)">New Chat</span>
            )}
          </div>
        </div>

        <div className="flex-1" />

        <RoutingPanel
          modelSelection={modelSelection}
          streamPhase={streamPhase}
          hasText={hasText}
          models={models}
        />

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
                className="flex h-7 w-7 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
                aria-label="More options"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

        {!(conversationId && conversation) && (
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
            aria-label="More options"
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </header>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{UI_TEXT.DELETE_CONFIRM_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>{UI_TEXT.DELETE_CONFIRM_BODY}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-(--error) text-white hover:opacity-90"
            >
              {UI_TEXT.DELETE_CONFIRM_ACTION}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
