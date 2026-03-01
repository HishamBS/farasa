import { router } from '../trpc'
import { chatRouter } from './chat'
import { conversationRouter } from './conversation'
import { modelRouter } from './model'
import { uploadRouter } from './upload'
import { searchRouter } from './search'
import { runtimeConfigRouter } from './runtime-config'
import { userPreferencesRouter } from './user-preferences'
import { groupRouter } from './group'

export const appRouter = router({
  chat: chatRouter,
  conversation: conversationRouter,
  model: modelRouter,
  upload: uploadRouter,
  search: searchRouter,
  runtimeConfig: runtimeConfigRouter,
  userPreferences: userPreferencesRouter,
  group: groupRouter,
})

export type AppRouter = typeof appRouter
