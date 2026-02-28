'use client'

import { useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { scaleIn, staggerContainer, fadeInUp } from '@/lib/utils/motion'
import type { SearchImage } from '@/schemas/search'

type ImageGalleryProps = {
  images: SearchImage[]
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const shouldReduce = useReducedMotion()
  const [selected, setSelected] = useState<SearchImage | null>(null)

  const handleOpen = useCallback((img: SearchImage) => setSelected(img), [])
  const handleClose = useCallback((open: boolean) => {
    if (!open) setSelected(null)
  }, [])

  if (images.length === 0) return null

  return (
    <>
      <motion.div
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        {...(shouldReduce ? {} : staggerContainer)}
      >
        {images.map((img, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={() => handleOpen(img)}
            className="relative aspect-square min-h-11 min-w-11 overflow-hidden rounded-xl border border-[--border-subtle] bg-[--bg-surface]"
            {...(shouldReduce ? {} : fadeInUp)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.description ?? ''}
              className={cn(
                'size-full object-cover',
                !shouldReduce && 'transition-transform duration-200 hover:scale-105',
              )}
            />
          </motion.button>
        ))}
      </motion.div>

      <Dialog open={selected !== null} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl border-[--border-default] bg-[--bg-surface] p-2">
          {selected && (
            <motion.img
              src={selected.url}
              alt={selected.description ?? ''}
              className="max-h-[80vh] w-full rounded-xl object-contain"
              {...(shouldReduce ? {} : scaleIn)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
