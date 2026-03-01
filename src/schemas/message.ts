import { z } from 'zod'
import { STREAM_EVENTS, STREAM_PHASES, CHAT_MODES, LIMITS } from '@/config/constants'
import { SearchImageSchema, SearchModeSchema, SearchResultSchema } from './search'

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().int().positive(),
  storageUrl: z.string(),
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

const StreamEventMetaSchema = z.object({
  streamRequestId: z.string().uuid(),
  sequence: z.number().int().nonnegative().optional(),
  attempt: z.number().int().nonnegative().optional(),
})

export const StreamChunkSchema = z.discriminatedUnion('type', [
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.STATUS),
    phase: StreamPhaseSchema,
    message: z.string(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.THINKING),
    content: z.string(),
    isComplete: z.boolean(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.MODEL_SELECTED),
    model: z.string(),
    reasoning: z.string(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.TOOL_START),
    toolName: z.string(),
    input: z.unknown(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.TOOL_RESULT),
    toolName: z.string(),
    result: z.unknown(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.TEXT),
    content: z.string(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.A2UI),
    jsonl: z.string(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.ERROR),
    message: z.string(),
    code: z.string().optional(),
    recoverable: z.boolean().optional(),
    reasonCode: z.string().optional(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.DONE),
    usage: UsageSchema.optional(),
    terminalReason: z.string().optional(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.USER_MESSAGE_SAVED),
    messageId: z.string(),
  }),
  StreamEventMetaSchema.extend({
    type: z.literal(STREAM_EVENTS.CONVERSATION_CREATED),
    conversationId: z.string(),
  }),
])

export const InlineAttachmentSchema = z.object({
  dataUrl: z.string().max(LIMITS.INLINE_ATTACHMENT_MAX_DATA_URL_LENGTH),
  fileName: z.string(),
  fileType: z.string(),
})

export const ChatInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1),
  mode: SearchModeSchema.default(CHAT_MODES.CHAT),
  model: z.string().optional(),
  attachmentIds: z.array(z.string().uuid()).default([]),
  inlineAttachments: z.array(InlineAttachmentSchema).default([]),
})

export const ToolCallSchema = z.object({
  name: z.string(),
  input: z.unknown(),
  result: z.unknown().optional(),
  durationMs: z.number().int().nonnegative().optional(),
})

export const MessageMetadataSchema = z.object({
  streamRequestId: z.string().uuid().optional(),
  recoveryAttemptCount: z.number().int().nonnegative().optional(),
  failureReasonCode: z.string().optional(),
  modelUsed: z.string().optional(),
  routerReasoning: z.string().optional(),
  thinkingContent: z.string().optional(),
  thinkingDurationMs: z.number().int().nonnegative().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
  a2uiMessages: z.array(z.unknown()).optional(),
  searchQuery: z.string().optional(),
  searchResults: z.array(SearchResultSchema).optional(),
  searchImages: z.array(SearchImageSchema).optional(),
  usage: UsageSchema.optional(),
})

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  metadata: MessageMetadataSchema.nullable(),
  clientRequestId: z.string().uuid().nullable(),
  streamSequenceMax: z.number().int().nonnegative().nullable(),
  tokenCount: z.number().int().nonnegative().nullable(),
  createdAt: z.date(),
})

export type InlineAttachment = z.infer<typeof InlineAttachmentSchema>
export type MessageRole = z.infer<typeof MessageRoleSchema>
export type Attachment = z.infer<typeof AttachmentSchema>
export type Usage = z.infer<typeof UsageSchema>
export type StreamPhase = z.infer<typeof StreamPhaseSchema>
export type StreamChunk = z.infer<typeof StreamChunkSchema>
export type ChatInput = z.infer<typeof ChatInputSchema>
export type ToolCall = z.infer<typeof ToolCallSchema>
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>
export type Message = z.infer<typeof MessageSchema>
