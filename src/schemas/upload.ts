import { z } from 'zod'
import { LIMITS, SUPPORTED_FILE_TYPES } from '@/config/constants'

export const UploadRequestSchema = z.object({
  fileName: z.string().min(1).max(LIMITS.FILE_NAME_MAX_LENGTH),
  fileType: z.enum(SUPPORTED_FILE_TYPES),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(
      LIMITS.FILE_MAX_SIZE_BYTES,
      `File must be ≤ ${LIMITS.FILE_MAX_SIZE_BYTES / 1024 / 1024}MB`,
    ),
  conversationId: z.string().uuid().optional(),
})

export const UploadResponseSchema = z.object({
  attachmentId: z.string().uuid(),
  uploadUrl: z.string().url(),
  expiresAt: z.number().int().positive(),
})

export const ConfirmUploadSchema = z.object({
  attachmentId: z.string().uuid(),
})

export type UploadRequest = z.infer<typeof UploadRequestSchema>
export type UploadResponse = z.infer<typeof UploadResponseSchema>
export type ConfirmUpload = z.infer<typeof ConfirmUploadSchema>
