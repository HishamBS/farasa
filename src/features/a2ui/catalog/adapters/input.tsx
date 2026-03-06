'use client'

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { useDataBinding, useFormBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { TextFieldComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import {
  normalizeValueSource,
  ensureWritablePath,
  extractLiteralDefault,
} from '../normalize-value-source'

export function InputAdapter({
  surfaceId,
  componentId,
  label,
  text,
}: BaseComponentProps & TextFieldComponentProps) {
  const safeLabel = normalizeValueSource(label)
  const safeText = normalizeValueSource(text)
  const resolvedLabel = useDataBinding<string>(surfaceId, safeLabel, '')
  const writableSource = ensureWritablePath(safeText, componentId)
  const initialValue = extractLiteralDefault(safeText, '')
  const [value, setValue] = useFormBinding<string>(surfaceId, writableSource, initialValue)

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
        className="border-(--border-default) bg-(--bg-input) text-(--text-primary) placeholder:text-(--text-ghost) focus-visible:ring-2 focus-visible:ring-(--accent)/30 focus-visible:border-(--accent)"
      />
    </div>
  )
}
