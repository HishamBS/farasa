import OpenAI from 'openai'
import { env } from '@/config/env'
import { EXTERNAL_URLS, APP_CONFIG } from '@/config/constants'

export const openrouter = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: EXTERNAL_URLS.OPENROUTER_API,
  defaultHeaders: {
    'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
    'X-Title': APP_CONFIG.NAME,
  },
})
