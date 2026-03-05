import { z } from 'zod'
import { TEAM_LIMITS, THEMES } from '@/config/constants'

export const UserPreferencesUpdateSchema = z
  .object({
    theme: z.enum(THEMES),
    sidebarExpanded: z.boolean(),
    defaultModel: z.string().nullable(),
    teamModels: z
      .array(z.string())
      .min(TEAM_LIMITS.MIN_MODELS)
      .max(TEAM_LIMITS.MAX_MODELS)
      .optional(),
    teamSynthesizerModel: z.string().nullable().optional(),
  })
  .partial()

export type UserPreferencesUpdate = z.infer<typeof UserPreferencesUpdateSchema>
