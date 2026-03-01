import { z } from 'zod'

export const UserPreferencesUpdateSchema = z
  .object({
    theme: z.string(),
    sidebarExpanded: z.boolean(),
    defaultModel: z.string().nullable(),
  })
  .partial()

export type UserPreferencesUpdate = z.infer<typeof UserPreferencesUpdateSchema>
