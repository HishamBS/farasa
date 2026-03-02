import { eq } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { UserPreferencesUpdateSchema } from '@/schemas/user-preferences'
import { userPreferences } from '@/lib/db/schema'

export const userPreferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const [prefs] = await ctx.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.userId))
      .limit(1)
    if (prefs) {
      return prefs
    }

    const [created] = await ctx.db
      .insert(userPreferences)
      .values({ userId: ctx.userId })
      .returning()

    if (!created) {
      throw new Error('Failed to initialize user preferences')
    }

    return created
  }),

  update: protectedProcedure.input(UserPreferencesUpdateSchema).mutation(async ({ ctx, input }) => {
    await ctx.db
      .insert(userPreferences)
      .values({ userId: ctx.userId, ...input, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...input, updatedAt: new Date() },
      })
  }),
})
