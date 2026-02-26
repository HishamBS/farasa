import OpenAI from 'openai'
import { env } from '@/config/env'

export const openrouter = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
    'X-Title': 'Farasa',
  },
})
