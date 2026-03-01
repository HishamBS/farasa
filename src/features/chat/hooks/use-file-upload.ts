'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { trpc } from '@/trpc/provider'

export type UploadState = {
  token: string
  fileName: string
  progress: number
  attachmentId: string | null
  error: string | null
  isUploading: boolean
  previewUrl: string | null
  fileType: string
}

type UploadResult = {
  token: string
  attachmentId: string
}

export function useFileUpload() {
  const [uploadStates, setUploadStates] = useState<Map<string, UploadState>>(new Map())
  const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()
  const presignedUrlMutation = trpc.upload.presignedUrl.useMutation()
  const confirmMutation = trpc.upload.confirmUpload.useMutation()

  const supportedFileTypes = useMemo(
    () => runtimeConfigQuery.data?.limits.supportedFileTypes ?? [],
    [runtimeConfigQuery.data?.limits.supportedFileTypes],
  )

  const upsertState = useCallback(
    (token: string, updater: (previous?: UploadState) => UploadState) => {
      setUploadStates((prev) => {
        const next = new Map(prev)
        const previous = next.get(token)
        next.set(token, updater(previous))
        return next
      })
    },
    [],
  )

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      const token = crypto.randomUUID()
      const runtimeConfig = runtimeConfigQuery.data
      if (!runtimeConfig) {
        upsertState(token, () => ({
          token,
          fileName: file.name,
          progress: 0,
          attachmentId: null,
          error: 'Upload configuration unavailable.',
          isUploading: false,
          previewUrl: null,
          fileType: file.type,
        }))
        return null
      }

      if (!runtimeConfig.limits.supportedFileTypes.includes(file.type)) {
        upsertState(token, () => ({
          token,
          fileName: file.name,
          progress: 0,
          attachmentId: null,
          error: `Unsupported type: ${file.type}`,
          isUploading: false,
          previewUrl: null,
          fileType: file.type,
        }))
        return null
      }

      if (file.size > runtimeConfig.limits.fileMaxSizeBytes) {
        const maxSizeMb = runtimeConfig.limits.fileMaxSizeBytes / 1024 / 1024
        upsertState(token, () => ({
          token,
          fileName: file.name,
          progress: 0,
          attachmentId: null,
          error: `File exceeds ${maxSizeMb}MB limit`,
          isUploading: false,
          previewUrl: null,
          fileType: file.type,
        }))
        return null
      }

      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null

      upsertState(token, () => ({
        token,
        fileName: file.name,
        progress: 0,
        attachmentId: null,
        error: null,
        isUploading: true,
        previewUrl,
        fileType: file.type,
      }))

      try {
        const { uploadUrl, attachmentId } = await presignedUrlMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        })

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', file.type)
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return
            const progress = Math.round((event.loaded / event.total) * 100)
            upsertState(token, (previous) => ({
              ...(previous ?? {
                token,
                fileName: file.name,
                attachmentId: null,
                error: null,
                isUploading: true,
                previewUrl,
                fileType: file.type,
              }),
              progress,
            }))
          }
          xhr.onload = () =>
            xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.send(file)
        })

        await confirmMutation.mutateAsync({ attachmentId })

        upsertState(token, (previous) => ({
          ...(previous ?? {
            token,
            fileName: file.name,
            progress: 0,
            attachmentId: null,
            error: null,
            isUploading: false,
            previewUrl,
            fileType: file.type,
          }),
          progress: 100,
          attachmentId,
          isUploading: false,
          error: null,
        }))
        return { token, attachmentId }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        upsertState(token, (previous) => ({
          ...(previous ?? {
            token,
            fileName: file.name,
            progress: 0,
            attachmentId: null,
            error: null,
            isUploading: false,
            previewUrl,
            fileType: file.type,
          }),
          isUploading: false,
          error: message,
        }))
        return null
      }
    },
    [confirmMutation, presignedUrlMutation, runtimeConfigQuery.data, upsertState],
  )

  const removeFile = useCallback((token: string) => {
    setUploadStates((prev) => {
      const next = new Map(prev)
      const state = next.get(token)
      if (state?.previewUrl) {
        URL.revokeObjectURL(state.previewUrl)
      }
      next.delete(token)
      return next
    })
  }, [])

  useEffect(() => {
    return () => {
      setUploadStates((prev) => {
        for (const state of prev.values()) {
          if (state.previewUrl) {
            URL.revokeObjectURL(state.previewUrl)
          }
        }
        return prev
      })
    }
  }, [])

  return { uploadFile, uploadStates, removeFile, supportedFileTypes }
}
