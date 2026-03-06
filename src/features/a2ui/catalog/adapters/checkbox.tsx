'use client'

import { useCallback } from 'react'
import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { CheckBoxComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'
import { useFormField } from '../../hooks/use-form-field'

export function CheckBoxAdapter({
  surfaceId,
  componentId,
  label,
  value,
}: BaseComponentProps & CheckBoxComponentProps) {
  const safeLabel = normalizeValueSource(label)
  const resolvedLabel = useDataBinding<string>(surfaceId, safeLabel, '')
  const { value: checked, setValue } = useFormField(surfaceId, componentId, value, false)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.checked),
    [setValue],
  )

  return (
    <label className="group flex cursor-pointer items-center gap-3 rounded-lg border border-(--border-default) px-3.5 py-2.5 transition-colors hover:border-(--accent)/40 hover:bg-(--accent)/5 has-[:checked]:border-(--accent)/60 has-[:checked]:bg-(--accent)/8">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="size-4 shrink-0 cursor-pointer rounded border-(--border-default) accent-(--accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/30 focus-visible:ring-offset-1"
      />
      {resolvedLabel && (
        <span className="text-sm text-(--text-primary) select-none">{resolvedLabel}</span>
      )}
    </label>
  )
}
