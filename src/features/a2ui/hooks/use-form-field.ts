'use client'

import { useCallback, useState } from 'react'
import { useDataModelContext } from '@a2ui-sdk/react/0.8'
import { normalizeValueSource } from '../catalog/normalize-value-source'
import type { ValueSource } from '@a2ui-sdk/types/0.8'

type UseFormFieldResult<T> = {
  value: T
  setValue: (newValue: T) => void
}

function extractInitial(source: ValueSource | undefined, fallback: string): string
function extractInitial(source: ValueSource | undefined, fallback: number): number
function extractInitial(source: ValueSource | undefined, fallback: boolean): boolean
function extractInitial(
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
 * Shared state management for interactive A2UI adapters.
 * Encapsulates the normalizeValueSource + extractLiteralDefault + useState + setDataValue
 * wiring that every form adapter needs.
 */
export function useFormField(
  surfaceId: string,
  componentId: string,
  rawValue: ValueSource | undefined,
  fallback: string,
): UseFormFieldResult<string>
export function useFormField(
  surfaceId: string,
  componentId: string,
  rawValue: ValueSource | undefined,
  fallback: number,
): UseFormFieldResult<number>
export function useFormField(
  surfaceId: string,
  componentId: string,
  rawValue: ValueSource | undefined,
  fallback: boolean,
): UseFormFieldResult<boolean>
export function useFormField(
  surfaceId: string,
  componentId: string,
  rawValue: ValueSource | undefined,
  fallback: string | number | boolean,
): UseFormFieldResult<string> | UseFormFieldResult<number> | UseFormFieldResult<boolean> {
  const { setDataValue } = useDataModelContext()
  const normalized = normalizeValueSource(rawValue)

  const initialString = typeof fallback === 'string' ? extractInitial(normalized, fallback) : ''
  const initialNumber = typeof fallback === 'number' ? extractInitial(normalized, fallback) : 0
  const initialBoolean =
    typeof fallback === 'boolean' ? extractInitial(normalized, fallback) : false

  const [strValue, setStrValue] = useState(initialString)
  const [numValue, setNumValue] = useState(initialNumber)
  const [boolValue, setBoolValue] = useState(initialBoolean)

  const setString = useCallback(
    (newValue: string) => {
      setStrValue(newValue)
      setDataValue(surfaceId, `/${componentId}`, newValue)
    },
    [setDataValue, surfaceId, componentId],
  )

  const setNumber = useCallback(
    (newValue: number) => {
      setNumValue(newValue)
      setDataValue(surfaceId, `/${componentId}`, newValue)
    },
    [setDataValue, surfaceId, componentId],
  )

  const setBoolean = useCallback(
    (newValue: boolean) => {
      setBoolValue(newValue)
      setDataValue(surfaceId, `/${componentId}`, newValue)
    },
    [setDataValue, surfaceId, componentId],
  )

  if (typeof fallback === 'string') return { value: strValue, setValue: setString }
  if (typeof fallback === 'number') return { value: numValue, setValue: setNumber }
  return { value: boolValue, setValue: setBoolean }
}
