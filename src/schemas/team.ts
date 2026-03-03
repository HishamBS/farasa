import { TEAM_EVENTS, TEAM_LIMITS } from '@/config/constants'
import { z } from 'zod'
import { StreamChunkSchema } from './message'

export const TeamStreamInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1),
  models: z.array(z.string()).min(TEAM_LIMITS.MIN_MODELS).max(TEAM_LIMITS.MAX_MODELS),
  webSearchEnabled: z.boolean().default(false),
  attachmentIds: z.array(z.string().uuid()).default([]),
})

export const TeamModelChunkSchema = z.object({
  type: z.literal(TEAM_EVENTS.MODEL_CHUNK),
  modelId: z.string(),
  modelIndex: z.number().int().nonnegative(),
  chunk: StreamChunkSchema,
})

export const TeamStreamEventChunkSchema = z.object({
  type: z.literal(TEAM_EVENTS.STREAM_EVENT),
  chunk: StreamChunkSchema,
})

export const TeamDoneChunkSchema = z.object({
  type: z.literal(TEAM_EVENTS.DONE),
  teamId: z.string().uuid(),
  completedModels: z.array(z.string()),
})

export const TeamOutputChunkSchema = z.discriminatedUnion('type', [
  TeamModelChunkSchema,
  TeamStreamEventChunkSchema,
  TeamDoneChunkSchema,
])

export const TeamSynthesisChunkSchema = z.object({
  type: z.literal(TEAM_EVENTS.SYNTHESIS_CHUNK),
  content: z.string(),
})

export const TeamSynthesisDoneChunkSchema = z.object({
  type: z.literal(TEAM_EVENTS.SYNTHESIS_DONE),
  teamId: z.string().uuid(),
})

export const TeamSynthesisOutputChunkSchema = z.discriminatedUnion('type', [
  TeamSynthesisChunkSchema,
  TeamSynthesisDoneChunkSchema,
])

export const TeamSynthesizeInputSchema = z.object({
  teamId: z.string().uuid(),
  conversationId: z.string().uuid(),
  synthesisModel: z.string().min(1),
})

export type TeamStreamInput = z.infer<typeof TeamStreamInputSchema>
export type TeamModelChunk = z.infer<typeof TeamModelChunkSchema>
export type TeamStreamEventChunk = z.infer<typeof TeamStreamEventChunkSchema>
export type TeamDoneChunk = z.infer<typeof TeamDoneChunkSchema>
export type TeamOutputChunk = z.infer<typeof TeamOutputChunkSchema>
export type TeamSynthesisChunk = z.infer<typeof TeamSynthesisChunkSchema>
export type TeamSynthesisDoneChunk = z.infer<typeof TeamSynthesisDoneChunkSchema>
export type TeamSynthesisOutputChunk = z.infer<typeof TeamSynthesisOutputChunkSchema>
export type TeamSynthesizeInput = z.infer<typeof TeamSynthesizeInputSchema>
