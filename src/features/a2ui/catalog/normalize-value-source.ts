import type { ValueSource } from '@a2ui-sdk/types/0.8'

/**
 * Models sometimes send raw strings instead of ValueSource objects.
 * The SDK's useDataBinding and our TextAdapter do `'literalString' in value`
 * which throws TypeError on string primitives. This normalizes at the
 * system boundary before values reach the SDK.
 */
export function normalizeValueSource(value: ValueSource | undefined): ValueSource | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return { literalString: value }
  if (typeof value === 'number') return { literalNumber: value }
  if (typeof value === 'boolean') return { literalBoolean: value }
  return value
}

/**
 * Extracts the initial display value from a literal value source.
 * Used as the default for useState in interactive adapters.
 */
export function extractLiteralDefault<T>(source: ValueSource | undefined, fallback: T): T {
  if (!source || typeof source !== 'object') return fallback
  if ('literalString' in source) return source.literalString as unknown as T
  if ('literalNumber' in source) return source.literalNumber as unknown as T
  if ('literalBoolean' in source) return source.literalBoolean as unknown as T
  return fallback
}
