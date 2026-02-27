'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp } from '@/lib/utils/motion'
import type { Attachment } from '@/schemas/message'

type UserMessageProps = {
  content: string
  attachments?: Attachment[]
}

export function UserMessage({ content, attachments }: UserMessageProps) {
  const shouldReduce = useReducedMotion()

  return (
    <motion.div
      className="flex justify-end"
      {...(shouldReduce ? {} : fadeInUp)}
    >
      <div className="max-w-[80%] overflow-hidden rounded-2xl rounded-br-sm bg-[--bg-user-message] lg:max-w-[72%]">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((attachment) => {
              const isImage = attachment.fileType.startsWith('image/')
              if (isImage) {
                return (
                  <Image
                    key={attachment.id}
                    src={attachment.storageUrl}
                    alt={attachment.fileName}
                    width={400}
                    height={300}
                    className="max-h-48 w-auto rounded-lg object-cover"
                  />
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
        <p className="px-4 py-3 text-sm leading-relaxed text-[--text-primary] whitespace-pre-wrap">
          {content}
        </p>
      </div>
    </motion.div>
  )
}
