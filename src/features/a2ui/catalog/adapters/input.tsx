'use client'

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { TextFieldComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'
import { useFormField } from '../../hooks/use-form-field'

export function InputAdapter({
  surfaceId,
  componentId,
  label,
  text,
}: BaseComponentProps & TextFieldComponentProps) {
  const safeLabel = normalizeValueSource(label)
  const resolvedLabel = useDataBinding<string>(surfaceId, safeLabel, '')
  const { value, setValue } = useFormField(surfaceId, componentId, text, '')

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
    [setValue],
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
