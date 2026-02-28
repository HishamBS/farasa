'use client'

import { useState, useCallback, useEffect } from 'react'
import { trpc } from '@/trpc/provider'
import { SUPPORTED_FILE_TYPES, LIMITS } from '@/config/constants'

export type UploadState = {
  progress: number
  attachmentId: string | null
  error: string | null
  isUploading: boolean
  previewUrl: string | null
  fileType: string
}

const INITIAL: Omit<UploadState, 'previewUrl' | 'fileType'> = {
  progress: 0,
  attachmentId: null,
  error: null,
  isUploading: false,
}

export function useFileUpload() {
  const [uploadStates, setUploadStates] = useState<Map<string, UploadState>>(new Map())
  const presignedUrlMutation = trpc.upload.presignedUrl.useMutation()
  const confirmMutation = trpc.upload.confirmUpload.useMutation()

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      const fileType = file.type as (typeof SUPPORTED_FILE_TYPES)[number]

      if (!(SUPPORTED_FILE_TYPES as ReadonlyArray<string>).includes(fileType)) {
        setUploadStates((prev) =>
          new Map(prev).set(file.name, {
            ...INITIAL,
            previewUrl: null,
            fileType: file.type,
            error: `Unsupported type: ${file.type}`,
          }),
        )
        return null
      }

      if (file.size > LIMITS.FILE_MAX_SIZE_BYTES) {
        setUploadStates((prev) =>
          new Map(prev).set(file.name, {
            ...INITIAL,
            previewUrl: null,
            fileType: file.type,
            error: `File exceeds ${LIMITS.FILE_MAX_SIZE_BYTES / 1024 / 1024}MB limit`,
          }),
        )
        return null
      }

      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null

      setUploadStates((prev) =>
        new Map(prev).set(file.name, {
          ...INITIAL,
          isUploading: true,
          previewUrl,
          fileType: file.type,
        }),
      )

      try {
        const { uploadUrl, attachmentId } = await presignedUrlMutation.mutateAsync({
          fileName: file.name,
          fileType,
          fileSize: file.size,
        })

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', file.type)
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100)
              setUploadStates((prev) => {
                const current = prev.get(file.name)
                if (!current) return prev
                return new Map(prev).set(file.name, { ...current, progress: pct })
              })
            }
          }
          xhr.onload = () =>
            xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.send(file)
        })

        await confirmMutation.mutateAsync({ attachmentId })

        setUploadStates((prev) => {
          const current = prev.get(file.name)
          if (!current) return prev
          return new Map(prev).set(file.name, {
            ...current,
            progress: 100,
            attachmentId,
            isUploading: false,
          })
        })
        return attachmentId
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Upload failed'
        setUploadStates((prev) => {
          const current = prev.get(file.name)
          if (!current) return prev
          return new Map(prev).set(file.name, { ...current, isUploading: false, error })
        })
        return null
      }
    },
    [presignedUrlMutation, confirmMutation],
  )

  const removeFile = useCallback((fileName: string) => {
    setUploadStates((prev) => {
      const next = new Map(prev)
      const state = next.get(fileName)
      if (state?.previewUrl) URL.revokeObjectURL(state.previewUrl)
      next.delete(fileName)
      return next
    })
  }, [])

  // Revoke all preview object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setUploadStates((prev) => {
        for (const state of prev.values()) {
          if (state.previewUrl) URL.revokeObjectURL(state.previewUrl)
        }
        return prev
      })
    }
  }, [])

  return { uploadFile, uploadStates, removeFile }
}
