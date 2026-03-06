'use client'

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ModalComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { cn } from '@/lib/utils/cn'

const MODAL_CONTENT_MAX_HEIGHT = 'max-h-[85vh]'

export function ModalAdapter({
  surfaceId,
  entryPointChild,
  contentChild,
}: BaseComponentProps & ModalComponentProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = useCallback(() => setIsOpen(true), [])
  const handleClose = useCallback(() => setIsOpen(false), [])
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(true)
    }
  }, [])

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        className="cursor-pointer"
      >
        {entryPointChild && (
          <ComponentRenderer surfaceId={surfaceId} componentId={entryPointChild} />
        )}
      </div>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            role="presentation"
            onClick={handleClose}
          />
          <div
            className={cn(
              'relative z-10 m-4 w-full max-w-lg overflow-y-auto rounded-xl border border-(--border-default) bg-(--bg-surface) p-5 shadow-2xl',
              MODAL_CONTENT_MAX_HEIGHT,
            )}
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-primary)"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            {contentChild && <ComponentRenderer surfaceId={surfaceId} componentId={contentChild} />}
          </div>
        </div>
      )}
    </>
  )
}
