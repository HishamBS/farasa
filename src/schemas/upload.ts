import { z } from 'zod'
import { LIMITS, SUPPORTED_FILE_TYPES } from '@/config/constants'

const BASE64_DATA_URL = /^data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/

const SupportedFileTypeSchema = z
  .string()
  .refine((val) => (SUPPORTED_FILE_TYPES as readonly string[]).includes(val), {
    message: 'Unsupported file type',
  })

export const UploadRequestSchema = z.object({
  fileName: z.string().min(1),
  fileType: SupportedFileTypeSchema,
  fileSize: z.number().int().positive(),
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

export const StoreInlineSchema = z.object({
  dataUrl: z
    .string()
    .min(1)
    .regex(BASE64_DATA_URL, 'Must be a valid base64 data URL')
    .refine((val) => val.length <= LIMITS.INLINE_UPLOAD_MAX_SIZE, {
      message: 'Inline upload data URL exceeds maximum size',
    }),
  fileName: z.string().min(1),
  fileType: SupportedFileTypeSchema,
  fileSize: z.number().int().positive(),
})

export type UploadRequest = z.infer<typeof UploadRequestSchema>
export type UploadResponse = z.infer<typeof UploadResponseSchema>
export type ConfirmUpload = z.infer<typeof ConfirmUploadSchema>
export type StoreInline = z.infer<typeof StoreInlineSchema>
