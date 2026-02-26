import { router } from '../trpc'
import { chatRouter } from './chat'
import { conversationRouter } from './conversation'
import { modelRouter } from './model'
import { uploadRouter } from './upload'
import { searchRouter } from './search'

export const appRouter = router({
  chat: chatRouter,
  conversation: conversationRouter,
  model: modelRouter,
  upload: uploadRouter,
  search: searchRouter,
})

export type AppRouter = typeof appRouter
