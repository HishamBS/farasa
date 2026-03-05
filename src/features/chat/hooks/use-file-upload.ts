'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { trpc } from '@/trpc/provider'
import { getErrorMessage } from '@/lib/utils/errors'

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
  const uploadConfigQuery = trpc.upload.config.useQuery(undefined, { staleTime: Infinity })
  const presignedUrlMutation = trpc.upload.presignedUrl.useMutation()
  const confirmMutation = trpc.upload.confirmUpload.useMutation()
  const storeInlineMutation = trpc.upload.storeInline.useMutation()

  const gcsEnabled = uploadConfigQuery.data?.gcsEnabled ?? false

  const supportedFileTypes = useMemo(
    () => runtimeConfigQuery.data?.limits.supportedFileTypes ?? [],
    [runtimeConfigQuery.data?.limits.supportedFileTypes],
  )
  const fileMaxSizeBytes = runtimeConfigQuery.data?.limits.fileMaxSizeBytes ?? null

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

  const uploadFileInline = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      const token = crypto.randomUUID()
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null

      if (fileMaxSizeBytes !== null && file.size > fileMaxSizeBytes) {
        upsertState(token, () => ({
          token,
          fileName: file.name,
          progress: 0,
          attachmentId: null,
          error: 'File too large. Please upload a smaller file.',
          isUploading: false,
          previewUrl,
          fileType: file.type,
        }))
        return null
      }

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
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result
            if (typeof result === 'string') resolve(result)
            else reject(new Error('Unexpected FileReader result type'))
          }
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(file)
        })

        const { attachmentId } = await storeInlineMutation.mutateAsync({
          dataUrl,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        })

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
        const message = getErrorMessage(error, 'Failed to upload file')
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
    [fileMaxSizeBytes, storeInlineMutation, upsertState],
  )

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      const token = crypto.randomUUID()
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
        const message = getErrorMessage(error, 'Upload failed')
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
    [confirmMutation, presignedUrlMutation, upsertState],
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

  const clearFiles = useCallback(() => {
    setUploadStates((prev) => {
      for (const state of prev.values()) {
        if (state.previewUrl) {
          URL.revokeObjectURL(state.previewUrl)
        }
      }
      return new Map()
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

  return {
    uploadFile,
    uploadFileInline,
    gcsEnabled,
    uploadStates,
    removeFile,
    clearFiles,
    supportedFileTypes,
  }
}
