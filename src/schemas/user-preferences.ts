import { z } from 'zod'
import { GROUP_LIMITS } from '@/config/constants'

export const UserPreferencesUpdateSchema = z
  .object({
    theme: z.string(),
    sidebarExpanded: z.boolean(),
    defaultModel: z.string().nullable(),
    groupModels: z
      .array(z.string())
      .min(GROUP_LIMITS.MIN_MODELS)
      .max(GROUP_LIMITS.MAX_MODELS)
      .optional(),
    groupJudgeModel: z.string().nullable().optional(),
  })
  .partial()

export type UserPreferencesUpdate = z.infer<typeof UserPreferencesUpdateSchema>
