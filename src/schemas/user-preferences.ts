import { z } from 'zod'

export const UserPreferencesUpdateSchema = z
  .object({
    theme: z.string(),
    sidebarExpanded: z.boolean(),
    defaultModel: z.string().nullable(),
    groupModels: z.array(z.string()).min(2).max(3).optional(),
    groupJudgeModel: z.string().nullable().optional(),
  })
  .partial()

export type UserPreferencesUpdate = z.infer<typeof UserPreferencesUpdateSchema>
