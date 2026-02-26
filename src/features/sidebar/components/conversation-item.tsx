'use client'

import { useCallback, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Pin, PinOff, Trash2, Pencil } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'
import { ROUTES } from '@/config/routes'
import { trpc } from '@/trpc/provider'

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
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  const utils = trpc.useUtils()

  const updateMutation = trpc.conversation.update.useMutation({
    onSuccess: () => {
      void utils.conversation.list.invalidate()
    },
  })

  const deleteMutation = trpc.conversation.delete.useMutation({
    onSuccess: () => {
      void utils.conversation.list.invalidate()
      if (isActive) router.push(ROUTES.CHAT)
    },
  })

  const handleClick = useCallback(() => {
    if (!isEditing) router.push(ROUTES.CHAT_BY_ID(id))
  }, [id, isEditing, router])

  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      updateMutation.mutate({ id, isPinned: !isPinned })
    },
    [id, isPinned, updateMutation],
  )

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteMutation.mutate({ id })
    },
    [id, deleteMutation],
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

  const formattedDate = formatDate(new Date(updatedAt))

  return (
    <motion.div
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer min-h-11',
        'transition-colors hover:bg-[--bg-surface-hover]',
        isActive && 'bg-[--bg-surface-hover] border-l-2 border-[--accent] pl-2.5',
      )}
      onClick={handleClick}
      {...(shouldReduce ? {} : fadeInUp)}
    >
      {isPinned && (
        <Pin size={10} className="shrink-0 text-[--accent] opacity-60" />
      )}

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameCommit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-sm text-[--text-primary] outline-none border-b border-[--accent]"
          />
        ) : (
          <p className="truncate text-sm text-[--text-primary]">{title}</p>
        )}
        <p className="text-xs text-[--text-ghost]">{formattedDate}</p>
      </div>

      <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
        <button
          type="button"
          onClick={handleRenameStart}
          className="flex min-h-11 min-w-11 items-center justify-center rounded text-[--text-muted] hover:text-[--text-primary]"
          aria-label="Rename"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={handlePin}
          className="flex min-h-11 min-w-11 items-center justify-center rounded text-[--text-muted] hover:text-[--text-primary]"
          aria-label={isPinned ? 'Unpin' : 'Pin'}
        >
          {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          className="flex min-h-11 min-w-11 items-center justify-center rounded text-[--text-muted] hover:text-[--error]"
          aria-label="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  )
}
