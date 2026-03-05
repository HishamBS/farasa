'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { MoreHorizontal, Pin, PinOff, Trash2, Pencil, Download } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'
import { ROUTES } from '@/config/routes'
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog'
import { useConversationOperations } from '@/features/sidebar/hooks/use-conversation-operations'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  const { updateMutation, deleteMutation, isExporting, handleExport } = useConversationOperations({
    navigateOnDelete: isActive,
  })

  const handleClick = useCallback(() => {
    if (isEditing || isMenuOpen) return
    router.push(ROUTES.CHAT_BY_ID(id))
  }, [id, isEditing, isMenuOpen, router])

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

  const handleExportClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      void handleExport(id)
    },
    [id, handleExport],
  )

  const handleEditChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value),
    [],
  )

  const handleRenameStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    flushSync(() => setIsEditing(true))
    inputRef.current?.focus()
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

  return (
    <>
      <motion.div
        role="button"
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        className={cn(
          'group relative flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2',
          'transition-colors duration-150 hover:bg-(white/5)',
          isActive ? 'bg-(--bg-surface-active)' : 'bg-transparent',
        )}
        onClick={handleClick}
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

        <DropdownMenu onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex size-11 items-center justify-center rounded text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)',
                'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100',
                (isActive || isMenuOpen) && 'opacity-100',
              )}
              aria-label="More options"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
            onCloseAutoFocus={(e) => {
              if (isEditing) e.preventDefault()
            }}
          >
            <DropdownMenuItem onClick={handleRenameStart}>
              <Pencil size={14} className="mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportClick} disabled={isExporting}>
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

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConfirmed}
      />
    </>
  )
}
