'use client'

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { fadeInUp } from '@/lib/utils/motion'
import { MOTION } from '@/config/constants'
import type { UploadState } from '../hooks/use-file-upload'

type AttachmentPreviewProps = {
  fileName: string
  uploadState: UploadState
  onRemove: () => void
}

export function AttachmentPreview({ fileName, uploadState, onRemove }: AttachmentPreviewProps) {
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onRemove()
    },
    [onRemove],
  )

  const isImage = uploadState.fileType.startsWith('image/')

  return (
    <motion.div
      className="relative flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--bg-surface) p-2"
      {...fadeInUp}
      exit={{
        opacity: 0,
        scale: MOTION.SCALE_EXIT,
        transition: { duration: MOTION.DURATION_EXTRA_FAST },
      }}
    >
      {isImage && uploadState.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Dynamic blob URL; next/image requires configured remote patterns
        <img
          src={uploadState.previewUrl}
          alt={fileName}
          className="size-10 rounded-lg object-cover"
        />
      ) : (
        <div className="flex size-10 items-center justify-center rounded-lg bg-(--bg-glass)">
          <FileText className="size-4 text-(--text-muted)" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-(--text-primary)">{fileName}</p>
        {uploadState.isUploading && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-(--bg-glass)">
            <div
              className="h-full rounded-full bg-(--accent) transition-all duration-150"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        )}
        {uploadState.error && <p className="text-xs text-(--error)">{uploadState.error}</p>}
        {!uploadState.isUploading && !uploadState.error && uploadState.attachmentId && (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-(--success)" />
            <p className="text-xs text-(--success)">Ready</p>
          </div>
        )}
      </div>

      {uploadState.isUploading ? (
        <Loader2 className="size-3.5 animate-spin text-(--text-muted)" />
      ) : (
        <button
          type="button"
          onClick={handleRemove}
          className="flex min-h-11 min-w-11 items-center justify-center text-(--text-muted) transition-colors hover:text-(--text-primary)"
          aria-label="Remove attachment"
        >
          <X className="size-3.5" />
        </button>
      )}
    </motion.div>
  )
}
