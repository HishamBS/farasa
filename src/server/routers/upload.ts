import { existsSync } from 'node:fs'
import { and, eq, isNull, lt } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, rateLimitedUploadProcedure } from '../trpc'
import { UploadRequestSchema, ConfirmUploadSchema, StoreInlineSchema } from '@/schemas/upload'
import { attachments } from '@/lib/db/schema'
import { TRPC_CODES } from '@/config/constants'
import { env } from '@/config/env'

export const uploadRouter = router({
  config: protectedProcedure.query(() => {
    const credPath = env.GOOGLE_APPLICATION_CREDENTIALS
    const gcsEnabled =
      credPath !== undefined && env.GCS_BUCKET_NAME !== undefined && existsSync(credPath)
    return { gcsEnabled }
  }),

  presignedUrl: rateLimitedUploadProcedure
    .input(UploadRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { runtimeConfig } = ctx
      if (!runtimeConfig.limits.supportedFileTypes.includes(input.fileType)) {
        throw new TRPCError({ code: TRPC_CODES.BAD_REQUEST })
      }
      if (input.fileSize > runtimeConfig.limits.fileMaxSizeBytes) {
        throw new TRPCError({ code: TRPC_CODES.BAD_REQUEST })
      }

      const orphanCutoff = new Date(Date.now() - runtimeConfig.limits.uploadUrlExpiryMs)
      await ctx.db
        .delete(attachments)
        .where(
          and(
            eq(attachments.userId, ctx.userId),
            isNull(attachments.messageId),
            isNull(attachments.confirmedAt),
            lt(attachments.createdAt, orphanCutoff),
          ),
        )

      const { getPresignedUploadUrl } = await import('@/lib/upload/gcs')
      const { uploadUrl, storageUrl } = await getPresignedUploadUrl({
        fileName: input.fileName,
        fileType: input.fileType,
        expiresInMs: runtimeConfig.limits.uploadUrlExpiryMs,
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
        throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
      }

      return {
        uploadUrl,
        attachmentId: attachment.id,
        expiresAt: Date.now() + runtimeConfig.limits.uploadUrlExpiryMs,
      }
    }),

  confirmUpload: rateLimitedUploadProcedure
    .input(ConfirmUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const [confirmed] = await ctx.db
        .update(attachments)
        .set({ confirmedAt: new Date() })
        .where(and(eq(attachments.id, input.attachmentId), eq(attachments.userId, ctx.userId)))
        .returning({ id: attachments.id })

      if (!confirmed) {
        throw new TRPCError({ code: TRPC_CODES.NOT_FOUND })
      }

      return { id: confirmed.id }
    }),

  storeInline: rateLimitedUploadProcedure
    .input(StoreInlineSchema)
    .mutation(async ({ ctx, input }) => {
      const { runtimeConfig } = ctx
      if (!runtimeConfig.limits.supportedFileTypes.includes(input.fileType)) {
        throw new TRPCError({ code: TRPC_CODES.BAD_REQUEST })
      }

      const fileSize = Math.ceil(input.dataUrl.length * 0.75)
      if (fileSize > runtimeConfig.limits.fileMaxSizeBytes) {
        throw new TRPCError({ code: TRPC_CODES.BAD_REQUEST })
      }

      const [attachment] = await ctx.db
        .insert(attachments)
        .values({
          userId: ctx.userId,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize,
          storageUrl: input.dataUrl,
          confirmedAt: new Date(),
        })
        .returning({ id: attachments.id })

      if (!attachment) {
        throw new TRPCError({ code: TRPC_CODES.INTERNAL_SERVER_ERROR })
      }

      return { attachmentId: attachment.id }
    }),
})
