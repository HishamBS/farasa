import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { UploadRequestSchema } from '@/schemas/upload'
import { attachments } from '@/lib/db/schema'
import { LIMITS } from '@/config/constants'

export const uploadRouter = router({
  presignedUrl: protectedProcedure
    .input(UploadRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { getPresignedUploadUrl } = await import('@/lib/upload/gcs')
      const { uploadUrl, storageUrl } = await getPresignedUploadUrl({
        fileName: input.fileName,
        fileType: input.fileType,
      })

      const [attachment] = await ctx.db
        .insert(attachments)
        .values({
          userId: ctx.userId,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          storageUrl,
        })
        .returning()

      if (!attachment) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
      }

      return {
        uploadUrl,
        storageUrl,
        attachmentId: attachment.id,
        expiresAt: Date.now() + LIMITS.UPLOAD_URL_EXPIRY_MS,
      }
    }),
})
