'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { FILE_EXTENSION_TO_MIME } from '@/config/constants'
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

  const resolveAllowedFileType = useCallback(
    (file: File): string | null => {
      const declaredType = file.type.trim().toLowerCase()
      const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : ''
      const inferredType = extension ? FILE_EXTENSION_TO_MIME[extension] : undefined
      const hasAllowList = supportedFileTypes.length > 0

      if (!hasAllowList) {
        return declaredType || inferredType || null
      }
      if (declaredType && supportedFileTypes.includes(declaredType)) {
        return declaredType
      }
      if (inferredType && supportedFileTypes.includes(inferredType)) {
        return inferredType
      }
      return null
    },
    [supportedFileTypes],
  )

  const setRejectedFileState = useCallback(
    (token: string, file: File, message: string) => {
      upsertState(token, () => ({
        token,
        fileName: file.name,
        progress: 0,
        attachmentId: null,
        error: message,
        isUploading: false,
        previewUrl: null,
        fileType: file.type,
      }))
    },
    [upsertState],
  )

  const uploadFileInline = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      const token = crypto.randomUUID()
      const resolvedType = resolveAllowedFileType(file)
      if (!resolvedType) {
        setRejectedFileState(
          token,
          file,
          'Unsupported file type. Please upload a supported format.',
        )
        return null
      }

      const normalizedFile =
        file.type === resolvedType
          ? file
          : new File([file], file.name, { type: resolvedType, lastModified: file.lastModified })
      const previewUrl = resolvedType.startsWith('image/')
        ? URL.createObjectURL(normalizedFile)
        : null

      if (fileMaxSizeBytes !== null && normalizedFile.size > fileMaxSizeBytes) {
        upsertState(token, () => ({
          token,
          fileName: normalizedFile.name,
          progress: 0,
          attachmentId: null,
          error: 'File too large. Please upload a smaller file.',
          isUploading: false,
          previewUrl,
          fileType: resolvedType,
        }))
        return null
      }

      upsertState(token, () => ({
        token,
        fileName: normalizedFile.name,
        progress: 0,
        attachmentId: null,
        error: null,
        isUploading: true,
        previewUrl,
        fileType: resolvedType,
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
          reader.readAsDataURL(normalizedFile)
        })

        const { attachmentId } = await storeInlineMutation.mutateAsync({
          dataUrl,
          fileName: normalizedFile.name,
          fileType: resolvedType,
          fileSize: normalizedFile.size,
        })

        upsertState(token, (previous) => ({
          ...(previous ?? {
            token,
            fileName: normalizedFile.name,
            progress: 0,
            attachmentId: null,
            error: null,
            isUploading: false,
            previewUrl,
            fileType: resolvedType,
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
            fileName: normalizedFile.name,
            progress: 0,
            attachmentId: null,
            error: null,
            isUploading: false,
            previewUrl,
            fileType: resolvedType,
          }),
          isUploading: false,
          error: message,
        }))
        return null
      }
    },
    [
      fileMaxSizeBytes,
      resolveAllowedFileType,
      setRejectedFileState,
      storeInlineMutation,
      upsertState,
    ],
  )

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      const token = crypto.randomUUID()
      const resolvedType = resolveAllowedFileType(file)
      if (!resolvedType) {
        setRejectedFileState(
          token,
          file,
          'Unsupported file type. Please upload a supported format.',
        )
        return null
      }

      const normalizedFile =
        file.type === resolvedType
          ? file
          : new File([file], file.name, { type: resolvedType, lastModified: file.lastModified })
      const previewUrl = resolvedType.startsWith('image/')
        ? URL.createObjectURL(normalizedFile)
        : null

      upsertState(token, () => ({
        token,
        fileName: normalizedFile.name,
        progress: 0,
        attachmentId: null,
        error: null,
        isUploading: true,
        previewUrl,
        fileType: resolvedType,
      }))

      try {
        const { uploadUrl, attachmentId } = await presignedUrlMutation.mutateAsync({
          fileName: normalizedFile.name,
          fileType: resolvedType,
          fileSize: normalizedFile.size,
        })

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', resolvedType)
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return
            const progress = Math.round((event.loaded / event.total) * 100)
            upsertState(token, (previous) => ({
              ...(previous ?? {
                token,
                fileName: normalizedFile.name,
                attachmentId: null,
                error: null,
                isUploading: true,
                previewUrl,
                fileType: resolvedType,
              }),
              progress,
            }))
          }
          xhr.onload = () =>
            xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.send(normalizedFile)
        })

        await confirmMutation.mutateAsync({ attachmentId })

        upsertState(token, (previous) => ({
          ...(previous ?? {
            token,
            fileName: normalizedFile.name,
            progress: 0,
            attachmentId: null,
            error: null,
            isUploading: false,
            previewUrl,
            fileType: resolvedType,
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
            fileName: normalizedFile.name,
            progress: 0,
            attachmentId: null,
            error: null,
            isUploading: false,
            previewUrl,
            fileType: resolvedType,
          }),
          isUploading: false,
          error: message,
        }))
        return null
      }
    },
    [
      confirmMutation,
      presignedUrlMutation,
      resolveAllowedFileType,
      setRejectedFileState,
      upsertState,
    ],
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
