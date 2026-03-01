'use client'

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { useDataBinding, useFormBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { TextFieldComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'

export function InputAdapter({
  surfaceId,
  label,
  text,
}: BaseComponentProps & TextFieldComponentProps) {
  const resolvedLabel = useDataBinding<string>(surfaceId, label, '')
  const [value, setValue] = useFormBinding<string>(surfaceId, text, '')

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
    [setValue],
  )

  return (
    <div className="flex flex-col gap-1.5">
      {resolvedLabel && (
        <label className="text-xs font-medium text-(--text-muted)">{resolvedLabel}</label>
      )}
      <Input
        value={value}
        onChange={handleChange}
        className="border-(--border-default) bg-(--bg-input) text-(--text-primary) placeholder:text-(--text-ghost)"
      />
    </div>
  )
}
