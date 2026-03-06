import type { ValueSource, Action } from '@a2ui-sdk/types/0.8'

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
export function extractLiteralDefault(source: ValueSource | undefined, fallback: string): string
export function extractLiteralDefault(source: ValueSource | undefined, fallback: number): number
export function extractLiteralDefault(source: ValueSource | undefined, fallback: boolean): boolean
export function extractLiteralDefault(
  source: ValueSource | undefined,
  fallback: string | number | boolean,
): string | number | boolean {
  if (!source || typeof source !== 'object') return fallback
  if ('literalString' in source && typeof source.literalString === 'string')
    return source.literalString
  if ('literalNumber' in source && typeof source.literalNumber === 'number')
    return source.literalNumber
  if ('literalBoolean' in source && typeof source.literalBoolean === 'boolean')
    return source.literalBoolean
  return fallback
}

/**
 * Models sometimes send action as a raw string instead of the {name, context} object
 * the SDK expects. This normalizes at the system boundary.
 */
export function normalizeAction(rawAction: Action | undefined): Action | undefined {
  if (!rawAction) return undefined
  const raw: unknown = rawAction
  if (typeof raw === 'string') return { name: raw }
  return rawAction
}
