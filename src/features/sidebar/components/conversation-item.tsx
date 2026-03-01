'use client'

import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { MoreHorizontal, Pin, PinOff, Trash2, Pencil, Download } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'
import { ROUTES } from '@/config/routes'
import { UX, UI_TEXT } from '@/config/constants'
import { trpc } from '@/trpc/provider'
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

type ConversationItemProps = {
  id: string
  title: string
  isPinned: boolean
  isActive: boolean
  updatedAt: Date
}

export function ConversationItem({
  id,
  title,
  isPinned,
  isActive,
  updatedAt,
}: ConversationItemProps) {
  const shouldReduce = useReducedMotion()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null)

  const utils = trpc.useUtils()

  const updateMutation = trpc.conversation.update.useMutation({
    onSuccess: () => {
      void utils.conversation.list.invalidate()
      void utils.conversation.getById.invalidate({ id })
    },
    onError: (err) => {
      console.error('Failed to update conversation', err)
    },
  })

  const deleteMutation = trpc.conversation.delete.useMutation({
    onSuccess: () => {
      void utils.conversation.list.invalidate()
      if (isActive) router.push(ROUTES.CHAT)
    },
    onError: (err) => {
      console.error('Failed to delete conversation', err)
    },
  })

  const handleClick = useCallback(() => {
    if (!isEditing) router.push(ROUTES.CHAT_BY_ID(id))
  }, [id, isEditing, router])

  const handleTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      dropdownTriggerRef.current?.click()
    }, UX.LONG_PRESS_DELAY_MS)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      updateMutation.mutate({ id, isPinned: !isPinned })
    },
    [id, isPinned, updateMutation],
  )

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }, [])

  const handleDeleteConfirmed = useCallback(() => {
    deleteMutation.mutate({ id })
  }, [id, deleteMutation])

  const handleExport = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      void (async () => {
        setIsExporting(true)
        try {
          const result = await utils.conversation.exportMarkdown.fetch({ id })
          const blob = new Blob([result.markdown], { type: 'text/markdown' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${result.title}.md`
          a.click()
          URL.revokeObjectURL(url)
        } catch (err) {
          console.error('Export failed', err)
        } finally {
          setIsExporting(false)
        }
      })()
    },
    [id, utils],
  )

  const handleEditChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value),
    [],
  )

  const handleRenameStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleRenameCommit = useCallback(() => {
    setIsEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== title) {
      updateMutation.mutate({ id, title: trimmed })
    } else {
      setEditValue(title)
    }
  }, [editValue, id, title, updateMutation])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleRenameCommit()
      if (e.key === 'Escape') {
        setIsEditing(false)
        setEditValue(title)
      }
    },
    [handleRenameCommit, title],
  )

  const formattedDate = useMemo(() => formatDate(new Date(updatedAt)), [updatedAt])

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  return (
    <>
      <motion.div
        className={cn(
          'group relative flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2',
          'transition-colors duration-150 hover:bg-(white/5)',
          isActive ? 'bg-(--bg-surface-active)' : 'bg-transparent',
        )}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        {...(shouldReduce ? {} : fadeInUp)}
      >
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={handleEditChange}
              onBlur={handleRenameCommit}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-sm text-(--text-primary) outline-none border-b border-(--accent)"
            />
          ) : (
            <p
              className={cn(
                'truncate text-sm leading-snug font-normal',
                isActive ? 'text-(--text-primary)' : 'text-(--text-secondary)',
              )}
            >
              {title}
            </p>
          )}
          <p className="mt-0.5 text-xs text-(--text-muted)">{formattedDate}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              ref={dropdownTriggerRef}
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex size-11 items-center justify-center rounded text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)',
                'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                isActive && 'opacity-100',
              )}
              aria-label="More options"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={handleRenameStart}>
              <Pencil size={14} className="mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
              <Download size={14} className="mr-2" />
              Export
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePin}>
              {isPinned ? (
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
              onClick={handleDeleteClick}
              className="text-(--error) focus:text-(--error)"
            >
              <Trash2 size={14} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

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
