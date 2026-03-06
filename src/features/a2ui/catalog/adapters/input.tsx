'use client'

import { useCallback, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useDataBinding, useDataModelContext } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { TextFieldComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource, extractLiteralDefault } from '../normalize-value-source'

export function InputAdapter({
  surfaceId,
  componentId,
  label,
  text,
}: BaseComponentProps & TextFieldComponentProps) {
  const safeLabel = normalizeValueSource(label)
  const resolvedLabel = useDataBinding<string>(surfaceId, safeLabel, '')
  const { setDataValue } = useDataModelContext()
  const initialValue = extractLiteralDefault(normalizeValueSource(text), '')
  const [value, setValue] = useState(initialValue)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setValue(newValue)
      setDataValue(surfaceId, `/${componentId}`, newValue)
    },
    [setDataValue, surfaceId, componentId],
  )

  return (
    <div className="flex flex-col gap-2">
      {resolvedLabel && (
        <label className="text-sm font-medium text-(--text-secondary)">{resolvedLabel}</label>
      )}
      <Input
        value={value}
        onChange={handleChange}
        placeholder={resolvedLabel ? `Enter ${resolvedLabel.toLowerCase()}...` : undefined}
      />
    </div>
  )
}
