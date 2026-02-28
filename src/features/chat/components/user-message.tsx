'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { fadeIn, fadeInUp, scaleIn } from '@/lib/utils/motion'
import type { Attachment } from '@/schemas/message'

type UserMessageProps = {
  content: string
  attachments?: Attachment[]
}

export function UserMessage({ content, attachments }: UserMessageProps) {
  const shouldReduce = useReducedMotion()
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  return (
    <motion.div className="flex justify-end" {...(shouldReduce ? {} : fadeInUp)}>
      <div className="max-w-[80%] lg:max-w-[72%] overflow-hidden rounded-2xl rounded-br-sm border border-[--border-default] bg-[--bg-glass] backdrop-blur-md shadow-sm shadow-black/20">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((attachment) => {
              const isImage = attachment.fileType.startsWith('image/')
              if (isImage) {
                return (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => setLightboxSrc(attachment.storageUrl)}
                    className="cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                    aria-label={`View ${attachment.fileName} full size`}
                  >
                    <Image
                      src={attachment.storageUrl}
                      alt={attachment.fileName}
                      width={400}
                      height={300}
                      className="max-h-48 w-auto rounded-lg object-cover transition-opacity hover:opacity-90"
                    />
                  </button>
                )
              }
              return (
                <a
                  key={attachment.id}
                  href={attachment.storageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-[--border-default] bg-[--bg-surface] px-3 py-2 text-xs text-[--text-secondary] hover:text-[--text-primary]"
                >
                  <span className="max-w-[120px] truncate">{attachment.fileName}</span>
                </a>
              )
            })}
          </div>
        )}
        <p className="whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed text-[--text-primary]">
          {content}
        </p>
      </div>
      <AnimatePresence>
        {lightboxSrc && (
          <motion.div
            key="lightbox-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            {...fadeIn}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxSrc(null)}
          >
            <motion.div
              key="lightbox-content"
              className="relative"
              {...scaleIn}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxSrc}
                alt=""
                className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl shadow-black/50"
              />
              <button
                type="button"
                onClick={() => setLightboxSrc(null)}
                className="absolute -right-3 -top-3 flex size-7 items-center justify-center rounded-full border border-[--border-default] bg-[--bg-surface] text-[--text-muted] transition-colors hover:text-[--text-primary]"
                aria-label="Close image"
              >
                <X size={14} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
