import { router } from '../trpc'
import { conversationRouter } from './conversation'
import { modelRouter } from './model'
import { uploadRouter } from './upload'
import { searchRouter } from './search'

export const appRouter = router({
  conversation: conversationRouter,
  model: modelRouter,
  upload: uploadRouter,
  search: searchRouter,
})

export type AppRouter = typeof appRouter
