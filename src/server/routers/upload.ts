import { and, eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, rateLimitedUploadProcedure } from '../trpc'
import { UploadRequestSchema, ConfirmUploadSchema } from '@/schemas/upload'
import { attachments } from '@/lib/db/schema'
import { LIMITS } from '@/config/constants'

export const uploadRouter = router({
  presignedUrl: rateLimitedUploadProcedure
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
        attachmentId: attachment.id,
        expiresAt: Date.now() + LIMITS.UPLOAD_URL_EXPIRY_MS,
      }
    }),

  confirmUpload: rateLimitedUploadProcedure
    .input(ConfirmUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const [confirmed] = await ctx.db
        .update(attachments)
        .set({ confirmedAt: new Date() })
        .where(
          and(
            eq(attachments.id, input.attachmentId),
            eq(attachments.userId, ctx.userId),
          ),
        )
        .returning({ id: attachments.id })

      if (!confirmed) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return { id: confirmed.id }
    }),
})
