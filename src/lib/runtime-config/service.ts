import { and, eq } from 'drizzle-orm'
import { env } from '@/config/env'
import { db } from '@/lib/db/client'
import { runtimeConfigs } from '@/lib/db/schema'
import { LIMITS } from '@/config/constants'
import {
  RuntimeConfigSchema,
  RuntimeConfigOverrideSchema,
  type RuntimeConfig,
  type RuntimeConfigOverride,
} from '@/schemas/runtime-config'

type RuntimeScope = 'system' | 'tenant' | 'user'

type RuntimeConfigCacheEntry = {
  config: RuntimeConfig
  expiresAt: number
}

type RuntimeConfigOptions = {
  userId?: string
  tenantId?: string
  force?: boolean
}

type RuntimeConfigSource = {
  scope: RuntimeScope
  scopeKey: string | null
  payload: RuntimeConfigOverride
}

const runtimeConfigCache = new Map<string, RuntimeConfigCacheEntry>()

class RuntimeConfigError extends Error {
  constructor(
    message: string,
    readonly causeValue?: unknown,
  ) {
    super(message)
    this.name = 'RuntimeConfigError'
  }
}

function getCacheTtlMs(): number {
  return env.RUNTIME_CONFIG_CACHE_TTL_MS ?? LIMITS.RUNTIME_CONFIG_CACHE_TTL_MS
}

function getCacheKey(options: RuntimeConfigOptions): string {
  if (options.userId) return `user:${options.userId}`
  if (options.tenantId) return `tenant:${options.tenantId}`
  return 'system'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function mergeDeep(base: unknown, override: unknown): unknown {
  if (!isRecord(base) || !isRecord(override)) {
    return override
  }

  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const previous = result[key]
    if (isRecord(previous) && isRecord(value)) {
      result[key] = mergeDeep(previous, value)
      continue
    }
    result[key] = value
  }
  return result
}

function parseEnvRuntimeConfig(): RuntimeConfigOverride | null {
  const rawJson = env.RUNTIME_CONFIG_JSON
  if (!rawJson) {
    return null
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawJson)
  } catch (error) {
    throw new RuntimeConfigError('RUNTIME_CONFIG_JSON is not valid JSON.', error)
  }

  const parsed = RuntimeConfigOverrideSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new RuntimeConfigError('RUNTIME_CONFIG_JSON failed schema validation.', parsed.error)
  }
  return parsed.data
}

function parseStoredPayload(raw: unknown): RuntimeConfigOverride {
  const parsed = RuntimeConfigOverrideSchema.safeParse(raw)
  if (!parsed.success) {
    throw new RuntimeConfigError('Stored runtime config payload failed validation.', parsed.error)
  }
  return parsed.data
}

function isUndefinedTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const candidate = error as Error & { code?: string; cause?: unknown }
  if (candidate.code === '42P01') return true
  if (candidate.cause && typeof candidate.cause === 'object') {
    const cause = candidate.cause as { code?: string }
    if (cause.code === '42P01') return true
  }
  return false
}

async function loadDbSources(options: RuntimeConfigOptions): Promise<RuntimeConfigSource[]> {
  const scopes: RuntimeConfigSource[] = []
  try {
    const [systemRow] = await db
      .select({
        scope: runtimeConfigs.scope,
        scopeKey: runtimeConfigs.scopeKey,
        payload: runtimeConfigs.payload,
      })
      .from(runtimeConfigs)
      .where(eq(runtimeConfigs.scope, 'system'))
      .limit(1)

    if (systemRow) {
      scopes.push({
        scope: 'system',
        scopeKey: systemRow.scopeKey,
        payload: parseStoredPayload(systemRow.payload),
      })
    }

    if (options.tenantId) {
      const [tenantRow] = await db
        .select({
          scope: runtimeConfigs.scope,
          scopeKey: runtimeConfigs.scopeKey,
          payload: runtimeConfigs.payload,
        })
        .from(runtimeConfigs)
        .where(
          and(eq(runtimeConfigs.scope, 'tenant'), eq(runtimeConfigs.scopeKey, options.tenantId)),
        )
        .limit(1)
      if (tenantRow) {
        scopes.push({
          scope: 'tenant',
          scopeKey: tenantRow.scopeKey,
          payload: parseStoredPayload(tenantRow.payload),
        })
      }
    }

    if (options.userId) {
      const [userRow] = await db
        .select({
          scope: runtimeConfigs.scope,
          scopeKey: runtimeConfigs.scopeKey,
          payload: runtimeConfigs.payload,
        })
        .from(runtimeConfigs)
        .where(and(eq(runtimeConfigs.scope, 'user'), eq(runtimeConfigs.scopeKey, options.userId)))
        .limit(1)
      if (userRow) {
        scopes.push({
          scope: 'user',
          scopeKey: userRow.scopeKey,
          payload: parseStoredPayload(userRow.payload),
        })
      }
    }
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return scopes
    }
    throw error
  }

  return scopes
}

function buildRuntimeConfig(
  envConfig: RuntimeConfigOverride | null,
  dbSources: RuntimeConfigSource[],
): RuntimeConfig {
  const merged = dbSources.reduce<unknown>(
    (current, source) => mergeDeep(current, source.payload),
    envConfig ?? {},
  )

  const parsed = RuntimeConfigSchema.safeParse(merged)
  if (!parsed.success) {
    throw new RuntimeConfigError(
      'Runtime config is missing required keys or contains invalid values.',
      parsed.error,
    )
  }

  return parsed.data
}

export function clearRuntimeConfigCache(options?: { userId?: string; tenantId?: string }): void {
  if (!options) {
    runtimeConfigCache.clear()
    return
  }
  runtimeConfigCache.delete(getCacheKey(options))
}

export async function getRuntimeConfig(options: RuntimeConfigOptions = {}): Promise<RuntimeConfig> {
  const cacheKey = getCacheKey(options)
  const now = Date.now()
  const ttlMs = getCacheTtlMs()
  const cached = runtimeConfigCache.get(cacheKey)

  if (!options.force && cached && cached.expiresAt > now) {
    return cached.config
  }

  const envConfig = parseEnvRuntimeConfig()
  const dbSources = await loadDbSources(options)

  const resolved = buildRuntimeConfig(envConfig, dbSources)
  runtimeConfigCache.set(cacheKey, { config: resolved, expiresAt: now + ttlMs })
  return resolved
}
