import { z } from 'zod'

const envSchema = z.object({
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters. Run: bunx auth secret'),
  AUTH_GOOGLE_ID: z.string().min(1, 'AUTH_GOOGLE_ID is required'),
  AUTH_GOOGLE_SECRET: z.string().min(1, 'AUTH_GOOGLE_SECRET is required'),
  AUTH_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  TAVILY_API_KEY: z
    .string()
    .startsWith('tvly-', 'TAVILY_API_KEY must start with "tvly-". Get it from app.tavily.com'),
  GCS_BUCKET_NAME: z.string().min(1, 'GCS_BUCKET_NAME is required'),
  GCS_PROJECT_ID: z.string().min(1, 'GCS_PROJECT_ID is required'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  RUNTIME_CONFIG_JSON: z.string().optional(),
  RUNTIME_CONFIG_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

function loadEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    if (process.env.SKIP_ENV_VALIDATION === '1') {
      console.warn('[env] Skipping validation during build phase')
      return process.env as unknown as z.infer<typeof envSchema>
    }
    console.error('Invalid environment variables:')
    for (const error of parsed.error.errors) {
      console.error(`  ${error.path.join('.')}: ${error.message}`)
    }
    throw new Error('Invalid environment configuration. Check .env.example for required variables.')
  }

  return parsed.data
}

export const env = loadEnv()
export type Env = z.infer<typeof envSchema>
