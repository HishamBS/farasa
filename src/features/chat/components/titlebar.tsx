'use client'

import { useMemo, useCallback, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react'
import { trpc } from '@/trpc/provider'
import { ROUTES, PATTERNS } from '@/config/routes'
import { UX, UI_TEXT } from '@/config/constants'
import { ModeToggle } from './mode-toggle'
import { useChatMode } from '../context/chat-mode-context'
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
}

export function Titlebar({ onMenuClick }: TitlebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { mode, setMode } = useChatMode()
  const utils = trpc.useUtils()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const conversationId = useMemo(() => {
    const match = PATTERNS.CHAT_ID.exec(pathname)
    return match?.[1] ?? null
  }, [pathname])

  const { data: conversation } = trpc.conversation.getById.useQuery(
    { id: conversationId ?? '' },
    { enabled: !!conversationId, staleTime: UX.QUERY_STALE_TIME_FOREVER },
  )

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

  return (
    <>
      <header className="flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-[--border-subtle] px-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex size-7 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary] lg:hidden"
          aria-label={UI_TEXT.OPEN_SIDEBAR_ARIA}
        >
          <Menu size={18} />
        </button>

        <div className="flex-1 truncate">
          {title && (
            <span className="text-sm font-medium text-[--text-secondary]">{title}</span>
          )}
        </div>

        <ModeToggle value={mode} onChange={setMode} />

        {conversationId && conversation && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-primary]"
                aria-label="More options"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePin}>
                {conversation.isPinned ? (
                  <><PinOff size={14} className="mr-2" />Unpin</>
                ) : (
                  <><Pin size={14} className="mr-2" />Pin</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-[--error] focus:text-[--error]"
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              className="bg-[--error] text-white hover:opacity-90"
            >
              {UI_TEXT.DELETE_CONFIRM_ACTION}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
