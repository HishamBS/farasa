import { z } from 'zod'
import { GROUP_LIMITS, GROUP_EVENTS } from '@/config/constants'
import { StreamChunkSchema } from './message'

export const GroupStreamInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1),
  models: z.array(z.string()).min(GROUP_LIMITS.MIN_MODELS).max(GROUP_LIMITS.MAX_MODELS),
  attachmentIds: z.array(z.string().uuid()).default([]),
})

export const GroupModelChunkSchema = z.object({
  type: z.literal(GROUP_EVENTS.MODEL_CHUNK),
  modelId: z.string(),
  modelIndex: z.number().int().nonnegative(),
  chunk: StreamChunkSchema,
})

export const GroupDoneChunkSchema = z.object({
  type: z.literal(GROUP_EVENTS.DONE),
  groupId: z.string().uuid(),
  completedModels: z.array(z.string()),
})

export const GroupOutputChunkSchema = z.discriminatedUnion('type', [
  GroupModelChunkSchema,
  GroupDoneChunkSchema,
])

export const GroupSynthesisChunkSchema = z.object({
  type: z.literal(GROUP_EVENTS.SYNTHESIS_CHUNK),
  content: z.string(),
})

export const GroupSynthesisDoneChunkSchema = z.object({
  type: z.literal(GROUP_EVENTS.SYNTHESIS_DONE),
  groupId: z.string().uuid(),
})

export const GroupSynthesisOutputChunkSchema = z.discriminatedUnion('type', [
  GroupSynthesisChunkSchema,
  GroupSynthesisDoneChunkSchema,
])

export const GroupSynthesizeInputSchema = z.object({
  groupId: z.string().uuid(),
  conversationId: z.string().uuid(),
  judgeModel: z.string().min(1),
})

export type GroupStreamInput = z.infer<typeof GroupStreamInputSchema>
export type GroupModelChunk = z.infer<typeof GroupModelChunkSchema>
export type GroupDoneChunk = z.infer<typeof GroupDoneChunkSchema>
export type GroupOutputChunk = z.infer<typeof GroupOutputChunkSchema>
export type GroupSynthesisChunk = z.infer<typeof GroupSynthesisChunkSchema>
export type GroupSynthesisDoneChunk = z.infer<typeof GroupSynthesisDoneChunkSchema>
export type GroupSynthesisOutputChunk = z.infer<typeof GroupSynthesisOutputChunkSchema>
export type GroupSynthesizeInput = z.infer<typeof GroupSynthesizeInputSchema>
