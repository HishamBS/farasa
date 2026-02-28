import { OpenRouter } from '@openrouter/sdk'
import { env } from '@/config/env'
import { APP_CONFIG } from '@/config/constants'

export const openrouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
  httpReferer: env.NEXT_PUBLIC_APP_URL,
  xTitle: APP_CONFIG.NAME,
})
