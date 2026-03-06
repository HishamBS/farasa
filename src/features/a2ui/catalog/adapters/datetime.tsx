'use client'

import { useCallback } from 'react'
import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { DateTimeInputComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'
import { useFormField } from '../../hooks/use-form-field'

export function DateTimeInputAdapter({
  surfaceId,
  componentId,
  label,
  value,
  enableDate = true,
  enableTime = false,
}: BaseComponentProps & DateTimeInputComponentProps) {
  const safeLabel = normalizeValueSource(label)
  const resolvedLabel = useDataBinding<string>(surfaceId, safeLabel, '')
  const { value: current, setValue } = useFormField(surfaceId, componentId, value, '')

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
    [setValue],
  )

  const inputType = enableDate && enableTime ? 'datetime-local' : enableTime ? 'time' : 'date'

  return (
    <div className="flex flex-col gap-2">
      {resolvedLabel && (
        <label className="text-sm font-medium text-(--text-secondary)">{resolvedLabel}</label>
      )}
      <input
        type={inputType}
        value={current}
        onChange={handleChange}
        className="rounded-lg border border-(--border-default) bg-(--bg-input) px-3.5 py-2.5 text-sm text-(--text-primary) transition-colors [color-scheme:dark] placeholder:text-(--text-ghost) focus-visible:border-(--accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/30"
      />
    </div>
  )
}
