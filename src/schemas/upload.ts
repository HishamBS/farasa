import { z } from 'zod'

export const UploadRequestSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
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

export type UploadRequest = z.infer<typeof UploadRequestSchema>
export type UploadResponse = z.infer<typeof UploadResponseSchema>
export type ConfirmUpload = z.infer<typeof ConfirmUploadSchema>
