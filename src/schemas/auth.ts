import { z } from 'zod'

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullish(),
  image: z.string().url().nullish(),
})

export const SessionSchema = z.object({
  user: SessionUserSchema,
  expires: z.string(),
})

export type SessionUser = z.infer<typeof SessionUserSchema>
export type Session = z.infer<typeof SessionSchema>
