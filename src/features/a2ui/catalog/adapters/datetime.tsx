'use client'

import { useCallback } from 'react'
import { useDataBinding, useFormBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { DateTimeInputComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'

export function DateTimeInputAdapter({
  surfaceId,
  label,
  value,
  enableDate = true,
  enableTime = false,
}: BaseComponentProps & DateTimeInputComponentProps) {
  const safeLabel = normalizeValueSource(label)
  const safeValue = normalizeValueSource(value)
  const resolvedLabel = useDataBinding<string>(surfaceId, safeLabel, '')
  const [current, setCurrent] = useFormBinding<string>(surfaceId, safeValue, '')

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setCurrent(e.target.value),
    [setCurrent],
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
