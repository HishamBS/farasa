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
