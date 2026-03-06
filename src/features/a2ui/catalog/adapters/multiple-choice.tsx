'use client'

import { useCallback, useState } from 'react'
import { useDataBinding, useDataModelContext } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { MultipleChoiceComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource, extractLiteralDefault } from '../normalize-value-source'
import { cn } from '@/lib/utils/cn'

export function MultipleChoiceAdapter({
  surfaceId,
  componentId,
  label,
  selections,
  options,
}: BaseComponentProps & MultipleChoiceComponentProps) {
  const safeLabel = normalizeValueSource(label)
  const resolvedLabel = useDataBinding<string>(surfaceId, safeLabel, '')
  const { setDataValue } = useDataModelContext()
  const initialValue = extractLiteralDefault(normalizeValueSource(selections), '')
  const [selected, setSelected] = useState(initialValue)

  const handleSelect = useCallback(
    (value: string) => {
      setSelected(value)
      setDataValue(surfaceId, `/${componentId}`, value)
    },
    [setDataValue, surfaceId, componentId],
  )

  if (!options || options.length === 0) return null

  return (
    <fieldset className="flex flex-col gap-2">
      {resolvedLabel && (
        <legend className="mb-1 text-sm font-medium text-(--text-secondary)">
          {resolvedLabel}
        </legend>
      )}
      <div className="flex flex-col gap-1.5">
        {options.map((option) => {
          const optionLabel =
            option.label && typeof option.label === 'object' && 'literalString' in option.label
              ? option.label.literalString
              : typeof option.label === 'string'
                ? option.label
                : option.value
          const isSelected = selected === option.value

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-all',
                isSelected
                  ? 'border-(--accent)/60 bg-(--accent)/8 text-(--text-primary) shadow-sm'
                  : 'border-(--border-default) text-(--text-secondary) hover:border-(--accent)/40 hover:bg-(--accent)/5',
              )}
            >
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isSelected ? 'border-(--accent)' : 'border-(--border-strong)',
                )}
              >
                {isSelected && <span className="size-2 rounded-full bg-(--accent)" />}
              </span>
              <span className="select-none">{optionLabel}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
