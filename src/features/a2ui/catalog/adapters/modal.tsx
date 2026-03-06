'use client'

import { useState, useCallback } from 'react'
import { ComponentRenderer } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ModalComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

export function ModalAdapter({
  surfaceId,
  entryPointChild,
  contentChild,
}: BaseComponentProps & ModalComponentProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpenChange = useCallback((open: boolean) => setIsOpen(open), [])

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div role="button" tabIndex={0} className="cursor-pointer">
          {entryPointChild && (
            <ComponentRenderer surfaceId={surfaceId} componentId={entryPointChild} />
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="border-(--border-default) bg-(--bg-surface) max-h-[85vh] overflow-y-auto">
        {contentChild && <ComponentRenderer surfaceId={surfaceId} componentId={contentChild} />}
      </DialogContent>
    </Dialog>
  )
}
