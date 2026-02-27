import { z } from 'zod'
import { LIMITS } from '@/config/constants'

export const CreateConversationSchema = z.object({
  title: z.string().max(LIMITS.CONVERSATION_TITLE_MAX_LENGTH).optional(),
  model: z.string().optional(),
})

export const UpdateConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(LIMITS.CONVERSATION_TITLE_MAX_LENGTH).optional(),
  model: z.string().optional(),
  isPinned: z.boolean().optional(),
})

export const ConversationByIdSchema = z.object({
  id: z.string().uuid(),
})

export const DeleteConversationSchema = z.object({
  id: z.string().uuid(),
})

export const ConversationFilterSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIMITS.PAGINATION_MAX_LIMIT)
    .default(LIMITS.PAGINATION_DEFAULT_LIMIT),
  cursor: z.string().datetime().optional(),
  search: z.string().max(LIMITS.SEARCH_QUERY_MAX_LENGTH).optional(),
})

export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  model: z.string().nullable(),
  isPinned: z.boolean(),
  updatedAt: z.date(),
  createdAt: z.date(),
})

export const GenerateTitleSchema = z.object({
  conversationId: z.string().uuid(),
  firstMessage: z.string().min(1).max(LIMITS.MESSAGE_MAX_LENGTH),
})

export const ExportConversationSchema = z.object({
  id: z.string().uuid(),
})

export const MessageListInputSchema = z.object({
  conversationId: z.string().uuid(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIMITS.PAGINATION_MAX_LIMIT)
    .default(LIMITS.PAGINATION_DEFAULT_LIMIT),
  cursor: z.string().datetime().optional(),
})

export type CreateConversation = z.infer<typeof CreateConversationSchema>
export type UpdateConversation = z.infer<typeof UpdateConversationSchema>
export type ConversationById = z.infer<typeof ConversationByIdSchema>
export type DeleteConversation = z.infer<typeof DeleteConversationSchema>
export type ConversationFilter = z.infer<typeof ConversationFilterSchema>
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>
export type GenerateTitle = z.infer<typeof GenerateTitleSchema>
export type ExportConversation = z.infer<typeof ExportConversationSchema>
export type MessageListInput = z.infer<typeof MessageListInputSchema>
