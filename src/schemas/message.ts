import { z } from 'zod'
import {
  STREAM_EVENTS,
  STREAM_PHASES,
  CHAT_MODES,
  LIMITS,
} from '@/config/constants'
import { SearchModeSchema, SearchResultSchema } from './search'

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().int().positive(),
  storageUrl: z.string().url(),
})

export const UsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  cost: z.number().nonnegative().optional(),
})

export const StreamPhaseSchema = z.enum([
  STREAM_PHASES.ROUTING,
  STREAM_PHASES.THINKING,
  STREAM_PHASES.SEARCHING,
  STREAM_PHASES.READING_FILES,
  STREAM_PHASES.GENERATING_UI,
  STREAM_PHASES.GENERATING_TITLE,
])

export const StreamChunkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(STREAM_EVENTS.STATUS),
    phase: StreamPhaseSchema,
    message: z.string(),
  }),
  z.object({
    type: z.literal(STREAM_EVENTS.THINKING),
    content: z.string(),
    isComplete: z.boolean(),
  }),
  z.object({
    type: z.literal(STREAM_EVENTS.MODEL_SELECTED),
    model: z.string(),
    reasoning: z.string(),
  }),
  z.object({
    type: z.literal(STREAM_EVENTS.TOOL_START),
    toolName: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal(STREAM_EVENTS.TOOL_RESULT),
    toolName: z.string(),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal(STREAM_EVENTS.TEXT),
    content: z.string(),
  }),
  z.object({
    type: z.literal(STREAM_EVENTS.A2UI),
    jsonl: z.string(),
  }),
  z.object({
    type: z.literal(STREAM_EVENTS.ERROR),
    message: z.string(),
    code: z.string().optional(),
  }),
  z.object({
    type: z.literal(STREAM_EVENTS.DONE),
    usage: UsageSchema.optional(),
  }),
])

export const ChatInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1).max(LIMITS.MESSAGE_MAX_LENGTH),
  mode: SearchModeSchema.default(CHAT_MODES.CHAT),
  model: z.string().optional(),
  attachmentIds: z.array(z.string().uuid()).default([]),
})

export const ToolCallSchema = z.object({
  name: z.string(),
  input: z.unknown(),
  result: z.unknown().optional(),
  durationMs: z.number().int().nonnegative().optional(),
})

export const MessageMetadataSchema = z.object({
  modelUsed: z.string().optional(),
  routerReasoning: z.string().optional(),
  thinkingContent: z.string().optional(),
  thinkingDurationMs: z.number().int().nonnegative().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
  a2uiMessages: z.array(z.unknown()).optional(),
  searchResults: z.array(SearchResultSchema).optional(),
  usage: UsageSchema.optional(),
})

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  metadata: MessageMetadataSchema.nullable(),
  tokenCount: z.number().int().nonnegative().nullable(),
  createdAt: z.date(),
})

export type MessageRole = z.infer<typeof MessageRoleSchema>
export type Attachment = z.infer<typeof AttachmentSchema>
export type Usage = z.infer<typeof UsageSchema>
export type StreamPhase = z.infer<typeof StreamPhaseSchema>
export type StreamChunk = z.infer<typeof StreamChunkSchema>
export type ChatInput = z.infer<typeof ChatInputSchema>
export type ToolCall = z.infer<typeof ToolCallSchema>
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>
export type Message = z.infer<typeof MessageSchema>
