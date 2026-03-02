import { z } from 'zod'
import { AttachmentSchema, ChatModeSchema, MessageSchema } from './message'
import { CHAT_MODES } from '@/config/constants'

export const CreateConversationSchema = z.object({
  title: z.string().min(1).optional(),
  model: z.string().nullable().optional(),
  firstMessage: z.string().min(1).optional(),
})

export const UpdateConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  model: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  mode: ChatModeSchema.optional(),
  webSearchEnabled: z.boolean().optional(),
})

export const ConversationByIdSchema = z.object({
  id: z.string().uuid(),
})

export const DeleteConversationSchema = z.object({
  id: z.string().uuid(),
})

export const ConversationFilterSchema = z.object({
  limit: z.number().int().min(1).optional(),
  cursor: z.string().datetime().optional(),
  search: z.string().min(1).optional(),
})

export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  model: z.string().nullable(),
  isPinned: z.boolean(),
  mode: ChatModeSchema.default(CHAT_MODES.CHAT),
  webSearchEnabled: z.boolean().default(false),
  updatedAt: z.date(),
  createdAt: z.date(),
})

export const GenerateTitleSchema = z.object({
  conversationId: z.string().uuid(),
  firstMessage: z.string().min(1),
})

export const ExportConversationSchema = z.object({
  id: z.string().uuid(),
})

export const MessageListInputSchema = z.object({
  conversationId: z.string().uuid(),
  limit: z.number().int().min(1).optional(),
  cursor: z.string().datetime().optional(),
})

export const MessageWithAttachmentsSchema = MessageSchema.extend({
  attachments: z.array(AttachmentSchema).default([]),
})

export const MessageListOutputSchema = z.object({
  messages: z.array(MessageWithAttachmentsSchema),
  nextCursor: z.string().datetime().nullable(),
})

export type MessageWithAttachments = z.infer<typeof MessageWithAttachmentsSchema>
export type MessageListOutput = z.infer<typeof MessageListOutputSchema>

export type CreateConversation = z.infer<typeof CreateConversationSchema>
export type UpdateConversation = z.infer<typeof UpdateConversationSchema>
export type ConversationById = z.infer<typeof ConversationByIdSchema>
export type DeleteConversation = z.infer<typeof DeleteConversationSchema>
export type ConversationFilter = z.infer<typeof ConversationFilterSchema>
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>
export type GenerateTitle = z.infer<typeof GenerateTitleSchema>
export type ExportConversation = z.infer<typeof ExportConversationSchema>
export type MessageListInput = z.infer<typeof MessageListInputSchema>
