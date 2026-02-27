'use client'

import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Pin, PinOff, Trash2, Pencil, Download } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'
import { ROUTES } from '@/config/routes'
import { UX } from '@/config/constants'
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
  const [isExporting, setIsExporting] = useState(false)
  const [isLongPressMenuOpen, setIsLongPressMenuOpen] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const utils = trpc.useUtils()

  const updateMutation = trpc.conversation.update.useMutation({
    onSuccess: () => {
      void utils.conversation.list.invalidate()
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
    if (isLongPressMenuOpen) {
      setIsLongPressMenuOpen(false)
      return
    }
    if (!isEditing) router.push(ROUTES.CHAT_BY_ID(id))
  }, [id, isEditing, isLongPressMenuOpen, router])

  const handleTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressMenuOpen(true)
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

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteMutation.mutate({ id })
    },
    [id, deleteMutation],
  )

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
    <motion.div
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer min-h-11',
        'transition-colors hover:bg-[--bg-surface-hover]',
        isActive && 'bg-[--bg-surface-hover] border-l-2 border-[--accent] pl-2.5',
      )}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onTouchMove={handleTouchEnd}
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
            onChange={handleEditChange}
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

      <div
        className={cn(
          'shrink-0 items-center gap-1',
          isLongPressMenuOpen ? 'flex' : 'hidden group-hover:flex',
        )}
      >
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
          onClick={handleExport}
          disabled={isExporting}
          className="flex min-h-11 min-w-11 items-center justify-center rounded text-[--text-muted] hover:text-[--text-primary] disabled:opacity-50"
          aria-label="Export as Markdown"
        >
          <Download size={12} />
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
